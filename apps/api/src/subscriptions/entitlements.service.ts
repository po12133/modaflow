import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import type { BillingPeriod, SubscriptionStatus, UsagePeriod } from '../generated/prisma/enums.js';
import { DATA_RETENTION_DAYS } from '../plans/plan-catalog.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  daysRemaining,
  effectiveStatus,
  type FeatureKey,
  fitsWithinLimit,
  isFeatureEnabled,
  isOperational,
  type LimitKey,
  retentionUntil,
  usageWindow,
} from './entitlement-rules.js';

export interface LimitUsage {
  limit: number;
  used: number;
}

export interface Entitlements {
  plan: {
    id: string;
    code: string;
    name: string;
    isTrial: boolean;
    priceCents: number;
    billingPeriod: BillingPeriod;
  };
  status: SubscriptionStatus;
  isOperational: boolean;
  startedAt: Date;
  expiresAt: Date;
  daysRemaining: number;
  /** Set once the subscription is no longer operational: data kept until this date. */
  dataRetentionUntil: Date | null;
  limits: {
    products: LimitUsage;
    aiAnalyses: LimitUsage & { period: UsagePeriod; periodStart: Date; periodEnd: Date };
    users: LimitUsage;
    branches: LimitUsage;
  };
  features: Record<FeatureKey, boolean>;
}

const FEATURE_LABELS: Record<FeatureKey, string> = {
  inventoryAndSales: 'Inventario y ventas',
  advancedReports: 'Reportes avanzados',
  onlineCatalog: 'Catálogo online',
  advancedManagement: 'Gestión avanzada',
};

const LIMIT_LABELS: Record<LimitKey, string> = {
  products: 'productos',
  aiAnalyses: 'análisis con IA',
  users: 'usuarios',
  branches: 'sucursales',
};

/**
 * Single source of truth for "what can this tenant do right now".
 * Reusable by inventory, sales, AI and catalog modules; always call it with
 * the tenant id resolved by TenantGuard, never with a client-supplied id.
 */
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForTenant(tenantId: string, now = new Date()): Promise<Entitlements> {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!sub) {
      throw new AppError(HttpStatus.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND', 'La tienda no tiene una suscripción.');
    }

    const status = effectiveStatus(sub, now);
    if (status !== sub.status) {
      // Persist the transition lazily; harmless if another request already did it.
      await this.prisma.subscription.updateMany({
        where: { id: sub.id, status: sub.status },
        data: { status },
      });
    }

    const window = usageWindow(sub.plan.aiAnalysesPeriod, sub, now);
    const [aiUsage, users, branches] = await Promise.all([
      this.prisma.subscriptionUsage.findUnique({
        where: { tenantId_metric_periodStart: { tenantId, metric: 'AI_ANALYSES', periodStart: window.start } },
        select: { used: true },
      }),
      this.prisma.tenantMembership.count({ where: { tenantId } }),
      this.prisma.store.count({ where: { tenantId } }),
    ]);
    const operational = isOperational(status);

    return {
      plan: {
        id: sub.plan.id,
        code: sub.plan.code,
        name: sub.plan.name,
        isTrial: sub.plan.isTrial,
        priceCents: sub.plan.priceCents,
        billingPeriod: sub.plan.billingPeriod,
      },
      status,
      isOperational: operational,
      startedAt: sub.startedAt,
      expiresAt: sub.currentPeriodEnd,
      daysRemaining: operational ? daysRemaining(sub.currentPeriodEnd, now) : 0,
      dataRetentionUntil: operational ? null : retentionUntil(sub.currentPeriodEnd, DATA_RETENTION_DAYS),
      limits: {
        // The product module does not exist yet: there are no products to count.
        products: { limit: sub.plan.maxProducts, used: 0 },
        aiAnalyses: {
          limit: sub.plan.aiAnalysesLimit,
          used: aiUsage?.used ?? 0,
          period: sub.plan.aiAnalysesPeriod,
          periodStart: window.start,
          periodEnd: window.end,
        },
        users: { limit: sub.plan.maxUsers, used: users },
        branches: { limit: sub.plan.maxBranches, used: branches },
      },
      features: {
        inventoryAndSales: isFeatureEnabled(sub.plan, status, 'inventoryAndSales'),
        advancedReports: isFeatureEnabled(sub.plan, status, 'advancedReports'),
        onlineCatalog: isFeatureEnabled(sub.plan, status, 'onlineCatalog'),
        advancedManagement: isFeatureEnabled(sub.plan, status, 'advancedManagement'),
      },
    };
  }

  /** Throws unless the subscription allows new business operations. */
  async assertOperational(tenantId: string): Promise<Entitlements> {
    const ent = await this.getForTenant(tenantId);
    if (!ent.isOperational) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'SUBSCRIPTION_INACTIVE',
        'Tu suscripción no está activa. Puedes consultar tus datos, pero no registrar operaciones nuevas.',
      );
    }
    return ent;
  }

  async assertFeature(tenantId: string, feature: FeatureKey): Promise<Entitlements> {
    const ent = await this.assertOperational(tenantId);
    if (!ent.features[feature]) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'FEATURE_NOT_IN_PLAN',
        `${FEATURE_LABELS[feature]} no está incluido en tu plan ${ent.plan.name}.`,
        { feature },
      );
    }
    return ent;
  }

  /** Throws when adding `increment` units would exceed the plan limit. */
  async assertWithinLimit(tenantId: string, key: LimitKey, increment = 1): Promise<Entitlements> {
    const ent = await this.assertOperational(tenantId);
    const { limit, used } = ent.limits[key];
    if (!fitsWithinLimit(limit, used, increment)) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'PLAN_LIMIT_REACHED',
        `Alcanzaste el límite de ${limit} ${LIMIT_LABELS[key]} de tu plan ${ent.plan.name}.`,
        { limit: key, max: limit, used },
      );
    }
    return ent;
  }

  /**
   * Atomically records one AI analysis if the plan allows it (for the future
   * AI module). The conditional UPDATE prevents concurrent requests from
   * exceeding the limit.
   */
  async consumeAiAnalysis(tenantId: string): Promise<void> {
    const ent = await this.assertWithinLimit(tenantId, 'aiAnalyses');
    const { limit, periodStart, periodEnd } = ent.limits.aiAnalyses;
    await this.prisma.subscriptionUsage.upsert({
      where: { tenantId_metric_periodStart: { tenantId, metric: 'AI_ANALYSES', periodStart } },
      create: { tenantId, metric: 'AI_ANALYSES', periodStart, periodEnd, used: 0 },
      update: {},
    });
    const updated = await this.prisma.subscriptionUsage.updateMany({
      where: { tenantId, metric: 'AI_ANALYSES', periodStart, used: { lt: limit } },
      data: { used: { increment: 1 } },
    });
    if (updated.count === 0) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'PLAN_LIMIT_REACHED',
        `Alcanzaste el límite de ${limit} análisis con IA de tu plan ${ent.plan.name}.`,
        { limit: 'aiAnalyses', max: limit },
      );
    }
  }
}
