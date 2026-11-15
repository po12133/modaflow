import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { imageKeys, processProductImage } from '../images/image-processing.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fromCents } from '../sales/sale-math.js';
import { StorageService } from '../storage/storage.service.js';
import { effectiveStatus } from '../subscriptions/entitlement-rules.js';
import type { CreatePaymentRequestDto } from './dto/payments.dto.js';
import { latestVersion } from './plan-versions.js';
import { PlatformSettingsService } from './platform-settings.service.js';

export const PAYMENT_SELECT = {
  id: true,
  status: true,
  method: true,
  amountExpected: true,
  amountConfirmed: true,
  receiptKey: true,
  receiptUploadedAt: true,
  submittedAt: true,
  reviewedAt: true,
  reviewNote: true,
  createdAt: true,
  toPlan: { select: { code: true, name: true } },
  fromPlan: { select: { name: true } },
  period: { select: { kind: true, periodStart: true, periodEnd: true } },
} as const;

type PaymentRow = Prisma.PlanChangeRequestGetPayload<{ select: typeof PAYMENT_SELECT }>;

@Injectable()
export class PaymentRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly settings: PlatformSettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  async view(row: PaymentRow) {
    const { receiptKey, ...rest } = row;
    return {
      ...rest,
      amountExpected: rest.amountExpected?.toFixed(2) ?? null,
      amountConfirmed: rest.amountConfirmed?.toFixed(2) ?? null,
      hasReceipt: Boolean(receiptKey),
      receiptUrl: receiptKey ? await this.storage.signedUrl(imageKeys(receiptKey).main).catch(() => null) : null,
    };
  }

  async create(tenantId: string, userId: string, dto: CreatePaymentRequestDto) {
    const [plan, sub, info] = await Promise.all([
      this.prisma.plan.findUnique({ where: { code: dto.planCode } }),
      this.prisma.subscription.findUnique({ where: { tenantId } }),
      this.settings.paymentInfo(),
    ]);
    if (!plan || !plan.isActive || plan.isTrial || plan.priceCents <= 0) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'PLAN_NOT_PAYABLE', 'Ese plan no se puede contratar.');
    }
    if (!sub) throw new AppError(HttpStatus.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND', 'La tienda no tiene una suscripción.');
    if (effectiveStatus(sub, new Date()) === 'SUSPENDED') {
      throw new AppError(HttpStatus.CONFLICT, 'SUBSCRIPTION_SUSPENDED', 'Tu negocio está suspendido. Escribe a soporte de ModaFlow.');
    }
    if (!info.methods.includes(dto.method)) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'PAYMENT_METHOD_UNAVAILABLE', 'Ese método de pago no está disponible por ahora.');
    }
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const version = await latestVersion(tx, plan.id);
        return tx.planChangeRequest.create({
          data: {
            tenantId,
            requestedById: userId,
            fromPlanId: sub.planId,
            toPlanId: plan.id,
            planVersionId: version.id,
            amountExpected: fromCents(version.priceCents),
            method: dto.method,
          },
          select: PAYMENT_SELECT,
        });
      });
      return this.view(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(HttpStatus.CONFLICT, 'PENDING_REQUEST_EXISTS', 'Ya tienes una solicitud de pago pendiente. Complétala o cancélala.');
      }
      throw error;
    }
  }

  async list(tenantId: string) {
    const rows = await this.prisma.planChangeRequest.findMany({
      where: { tenantId, amountExpected: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: PAYMENT_SELECT,
    });
    return Promise.all(rows.map((r) => this.view(r)));
  }

  private async pending(tenantId: string, id: string) {
    const row = await this.prisma.planChangeRequest.findFirst({ where: { id, tenantId, amountExpected: { not: null } }, select: { ...PAYMENT_SELECT, tenantId: true } });
    if (!row) throw new AppError(HttpStatus.NOT_FOUND, 'PAYMENT_NOT_FOUND', 'No se encontró la solicitud de pago.');
    return row;
  }

  async get(tenantId: string, id: string) {
    const { tenantId: _t, ...row } = await this.pending(tenantId, id);
    return this.view(row);
  }

  async uploadReceipt(tenantId: string, id: string, file: Buffer) {
    this.storage.assertConfigured();
    const row = await this.pending(tenantId, id);
    if (row.status !== 'PENDING' || row.submittedAt) throw this.locked();
    const processed = await processProductImage(file);
    const key = `tenants/${tenantId}/payments/${id}-${randomUUID()}`;
    const keys = imageKeys(key);
    await this.storage.put(keys.main, processed.main, processed.contentType);
    await this.storage.put(keys.thumb, processed.thumb, processed.contentType);
    const updated = await this.prisma.planChangeRequest.updateMany({ where: { id, tenantId, status: 'PENDING', submittedAt: null }, data: { receiptKey: key, receiptUploadedAt: new Date() } });
    if (updated.count === 0) throw this.locked();
    if (row.receiptKey) await this.storage.deleteMany(Object.values(imageKeys(row.receiptKey))).catch(() => undefined);
    return this.get(tenantId, id);
  }

  async submit(tenantId: string, id: string) {
    const row = await this.pending(tenantId, id);
    if (row.status !== 'PENDING') throw this.locked();
    if (!row.receiptKey) throw new AppError(HttpStatus.BAD_REQUEST, 'RECEIPT_REQUIRED', 'Sube la imagen del comprobante antes de enviarlo.');
    if (!row.submittedAt) {
      await this.prisma.planChangeRequest.updateMany({ where: { id, tenantId, status: 'PENDING', submittedAt: null }, data: { submittedAt: new Date() } });
      const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } });
      const data = { tenantName: tenant.name, planName: row.toPlan.name, amount: row.amountExpected?.toFixed(2), requestId: id };
      await this.notifications.notify({ audience: 'ADMIN', type: 'PAYMENT_SUBMITTED', dedupeKey: `admin:payment-submitted:${id}`, data });
      await this.notifications.notify({ audience: 'TENANT', tenantId, type: 'PAYMENT_SUBMITTED', dedupeKey: `tenant:payment-submitted:${id}`, data });
    }
    return this.get(tenantId, id);
  }

  async cancel(tenantId: string, id: string) {
    await this.pending(tenantId, id);
    const result = await this.prisma.planChangeRequest.updateMany({ where: { id, tenantId, status: 'PENDING' }, data: { status: 'CANCELED' } });
    if (result.count === 0) throw this.locked();
    return this.get(tenantId, id);
  }

  async periods(tenantId: string) {
    const rows = await this.prisma.subscriptionPeriod.findMany({
      where: { tenantId },
      orderBy: { periodStart: 'desc' },
      take: 50,
      select: { id: true, kind: true, periodStart: true, periodEnd: true, amount: true, plan: { select: { name: true } }, createdAt: true },
    });
    return rows.map((r) => ({ ...r, amount: r.amount.toFixed(2) }));
  }

  private locked() {
    return new AppError(HttpStatus.CONFLICT, 'PAYMENT_ALREADY_REVIEWED', 'Esta solicitud ya no se puede modificar.');
  }
}
