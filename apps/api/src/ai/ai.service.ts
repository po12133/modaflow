import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CategoriesService } from '../catalog/categories.service.js';
import { AppError } from '../common/app-error.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { Prisma } from '../generated/prisma/client.js';
import { ImagesService } from '../images/images.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { EntitlementsService } from '../subscriptions/entitlements.service.js';
import { GarmentRecognizer, RecognitionError } from './garment-recognizer.js';
import { type SuggestionView, toSuggestionView } from './suggestion.js';

export const MAX_IMAGES_PER_ANALYSIS = 4;

export interface AnalysisView {
  id: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  suggestion: SuggestionView | null;
  creditsCharged: number;
  usage: { limit: number; used: number; remaining: number };
  createdAt: Date;
}

/**
 * AI garment analysis with plan credits.
 *
 * Credit lifecycle: reserve (atomic, cannot exceed the limit) -> PENDING ->
 * SUCCEEDED (credit consumed) or FAILED (credit refunded). Failures before a
 * valid result never cost a credit, and a request retried with the same
 * idempotency key returns the stored result without charging again.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  /** A PENDING analysis older than this is considered lost (crash) and refunded. */
  private readonly staleAfterMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly recognizer: GarmentRecognizer,
    private readonly images: ImagesService,
    private readonly storage: StorageService,
    private readonly categories: CategoriesService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.staleAfterMs = (config.get('AI_TIMEOUT_MS', { infer: true }) ?? 60_000) * 2 + 30_000;
  }

  async analyzeGarment(tenantId: string, userId: string, imageIds: string[], idempotencyKey: string): Promise<AnalysisView> {
    if (!this.recognizer.configured) {
      throw new AppError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'AI_NOT_CONFIGURED',
        'El análisis con IA todavía no está disponible. Registra la prenda manualmente.',
      );
    }
    this.storage.assertConfigured();
    const ids = [...new Set(imageIds)];
    const images = await this.prisma.productImage.findMany({
      where: { id: { in: ids }, tenantId },
      select: { id: true, storageKey: true },
    });
    if (images.length !== ids.length) {
      throw new AppError(HttpStatus.NOT_FOUND, 'IMAGE_NOT_FOUND', 'Una de las fotos ya no está disponible.');
    }
    const ordered = ids.map((id) => images.find((img) => img.id === id)!);

    const existing = await this.prisma.aiAnalysis.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });
    if (existing?.status === 'SUCCEEDED') return this.view(tenantId, existing);
    if (existing?.status === 'PENDING' && Date.now() - existing.createdAt.getTime() < this.staleAfterMs) {
      throw new AppError(HttpStatus.CONFLICT, 'ANALYSIS_IN_PROGRESS', 'El análisis de estas fotos ya está en curso.');
    }

    await this.releaseStale(tenantId);
    const credit = await this.entitlements.reserveAiCredit(tenantId);

    let analysisId: string;
    try {
      const data = {
        userId,
        status: 'PENDING' as const,
        imageIds: ids,
        model: this.recognizer.model,
        creditsCharged: 1,
        usagePeriodStart: credit.periodStart,
        errorCode: null,
        result: Prisma.DbNull,
        createdAt: new Date(),
        completedAt: null,
      };
      const row = existing
        ? await this.prisma.aiAnalysis.update({ where: { id: existing.id }, data })
        : await this.prisma.aiAnalysis.create({ data: { ...data, tenantId, idempotencyKey } });
      analysisId = row.id;
    } catch (error) {
      await this.entitlements.refundAiCredit(tenantId, credit.periodStart);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(HttpStatus.CONFLICT, 'ANALYSIS_IN_PROGRESS', 'El análisis de estas fotos ya está en curso.');
      }
      throw error;
    }

    const started = Date.now();
    try {
      const [buffers, storeCategories] = await Promise.all([
        Promise.all(ordered.map((img) => this.images.readMain(img.storageKey))),
        this.categories.list(tenantId),
      ]);
      const result = await this.recognizer.recognize(
        buffers.map((data) => ({ data, mediaType: 'image/webp' as const })),
        storeCategories.map((c) => c.name),
      );
      const suggestion = toSuggestionView(result.suggestion, storeCategories);
      const saved = await this.prisma.aiAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'SUCCEEDED',
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          result: suggestion as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      this.logger.log(
        `AI analysis ${analysisId} succeeded in ${Date.now() - started} ms (tokens in ${result.inputTokens} / out ${result.outputTokens})`,
      );
      return this.view(tenantId, saved);
    } catch (error) {
      const code = error instanceof RecognitionError ? error.code : 'AI_UNAVAILABLE';
      await this.failAndRefund(tenantId, analysisId, code);
      this.logger.warn(`AI analysis ${analysisId} failed (${code}${error instanceof RecognitionError ? `: ${error.message}` : ''}); credit refunded`);
      if (error instanceof RecognitionError && error.code === 'AI_INVALID_RESPONSE') {
        throw new AppError(
          HttpStatus.BAD_GATEWAY,
          'AI_INVALID_RESPONSE',
          'La IA no pudo analizar estas fotos. No se descontó ningún crédito; prueba con otra foto o completa los datos manualmente.',
        );
      }
      throw new AppError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'AI_UNAVAILABLE',
        'El servicio de IA no respondió. No se descontó ningún crédito; intenta de nuevo o completa los datos manualmente.',
      );
    }
  }

  async usage(tenantId: string) {
    const ent = await this.entitlements.getForTenant(tenantId);
    const ai = ent.limits.aiAnalyses;
    const recent = await this.prisma.aiAnalysis.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, status: true, creditsCharged: true, createdAt: true, errorCode: true },
    });
    return {
      available: this.recognizer.configured && this.storage.isConfigured,
      aiConfigured: this.recognizer.configured,
      storageConfigured: this.storage.isConfigured,
      isOperational: ent.isOperational,
      limit: ai.limit,
      used: ai.used,
      remaining: Math.max(0, ai.limit - ai.used),
      period: ai.period,
      periodStart: ai.periodStart,
      periodEnd: ai.periodEnd,
      recent,
    };
  }

  /** Marks a PENDING analysis as FAILED and refunds its credit exactly once. */
  private async failAndRefund(tenantId: string, analysisId: string, errorCode: string) {
    await this.prisma.$transaction(async (tx) => {
      const marked = await tx.aiAnalysis.updateMany({
        where: { id: analysisId, tenantId, status: 'PENDING', creditsCharged: 1 },
        data: { status: 'FAILED', creditsCharged: 0, errorCode, completedAt: new Date() },
      });
      if (marked.count === 0) return;
      const analysis = await tx.aiAnalysis.findUniqueOrThrow({ where: { id: analysisId }, select: { usagePeriodStart: true } });
      await tx.subscriptionUsage.updateMany({
        where: { tenantId, metric: 'AI_ANALYSES', periodStart: analysis.usagePeriodStart, used: { gt: 0 } },
        data: { used: { decrement: 1 } },
      });
    });
  }

  /** Refunds analyses left PENDING by a crash or restart. */
  private async releaseStale(tenantId: string) {
    const stale = await this.prisma.aiAnalysis.findMany({
      where: { tenantId, status: 'PENDING', createdAt: { lt: new Date(Date.now() - this.staleAfterMs) } },
      select: { id: true },
      take: 20,
    });
    for (const a of stale) await this.failAndRefund(tenantId, a.id, 'STALE_PENDING');
  }

  private async view(
    tenantId: string,
    row: { id: string; status: 'PENDING' | 'SUCCEEDED' | 'FAILED'; result: Prisma.JsonValue | null; creditsCharged: number; createdAt: Date },
  ): Promise<AnalysisView> {
    const ent = await this.entitlements.getForTenant(tenantId);
    const ai = ent.limits.aiAnalyses;
    return {
      id: row.id,
      status: row.status,
      suggestion: row.status === 'SUCCEEDED' ? (row.result as unknown as SuggestionView) : null,
      creditsCharged: row.creditsCharged,
      usage: { limit: ai.limit, used: ai.used, remaining: Math.max(0, ai.limit - ai.used) },
      createdAt: row.createdAt,
    };
  }
}
