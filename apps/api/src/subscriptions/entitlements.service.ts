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
  contractedRules,
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

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForTenant(tenantId: string, now = new Date()): Promise<Entitlements> {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true, planVersion: true },
    });
    if (!sub) {
      throw new AppError(HttpStatus.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND', 'La tienda no tiene una suscripción.');
    }

    const status = effectiveStatus(sub, now);
    const rules = contractedRules(sub);

    const window = usageWindow(rules.aiAnalysesPeriod, sub, now);
    const [aiUsage, users, branches, products] = await Promise.all([
      this.prisma.subscriptionUsage.findUnique({
        where: { tenantId_metric_periodStart: { tenantId, metric: 'AI_ANALYSES', periodStart: window.start } },
        select: { used: true },
      }),
      this.prisma.tenantMembership.count({ where: { tenantId } }),
      this.prisma.store.count({ where: { tenantId } }),
      this.prisma.product.count({ where: { tenantId, status: 'ACTIVE' } }),
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
        products: { limit: rules.maxProducts, used: products },
        aiAnalyses: {
          limit: rules.aiAnalysesLimit,
          used: aiUsage?.used ?? 0,
          period: rules.aiAnalysesPeriod,
          periodStart: window.start,
          periodEnd: window.end,
        },
        users: { limit: rules.maxUsers, used: users },
        branches: { limit: rules.maxBranches, used: branches },
      },
      features: {
        inventoryAndSales: isFeatureEnabled(rules, status, 'inventoryAndSales'),
        advancedReports: isFeatureEnabled(rules, status, 'advancedReports'),
        onlineCatalog: isFeatureEnabled(rules, status, 'onlineCatalog'),
        advancedManagement: isFeatureEnabled(rules, status, 'advancedManagement'),
      },
    };
  }

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

  async reserveAiCredit(tenantId: string): Promise<{ periodStart: Date; limit: number; used: number }> {
    const ent = await this.assertOperational(tenantId);
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
        `Usaste los ${limit} análisis con IA de tu plan ${ent.plan.name}. Puedes registrar la prenda manualmente.`,
        { limit: 'aiAnalyses', max: limit },
      );
    }
    const row = await this.prisma.subscriptionUsage.findUniqueOrThrow({
      where: { tenantId_metric_periodStart: { tenantId, metric: 'AI_ANALYSES', periodStart } },
      select: { used: true },
    });
    return { periodStart, limit, used: row.used };
  }

  async refundAiCredit(tenantId: string, periodStart: Date): Promise<void> {
    await this.prisma.subscriptionUsage.updateMany({
      where: { tenantId, metric: 'AI_ANALYSES', periodStart, used: { gt: 0 } },
      data: { used: { decrement: 1 } },
    });
  }
}
