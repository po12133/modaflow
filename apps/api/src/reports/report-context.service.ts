import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { tenantTimezone } from '../common/tenant-timezone.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EntitlementsService, type Entitlements } from '../subscriptions/entitlements.service.js';
import type { PeriodQueryDto } from './dto.js';
import type { ResolvedPeriod } from './report-period.types.js';
import { PeriodError, resolvePeriod } from './report-periods.js';

export interface ReportContext {
  tenantId: string;
  tz: string;
  storeName: string;
  ent: Entitlements;
  advanced: boolean;
}

@Injectable()
export class ReportContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async load(tenantId: string): Promise<ReportContext> {
    const [store, ent, tz] = await Promise.all([
      this.prisma.store.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { name: true } }),
      this.entitlements.getForTenant(tenantId),
      tenantTimezone(this.prisma, tenantId),
    ]);
    return { tenantId, tz, storeName: store?.name ?? '', ent, advanced: ent.features.advancedReports };
  }

  async resolve(tenantId: string, q: PeriodQueryDto): Promise<{ ctx: ReportContext; period: ResolvedPeriod }> {
    const ctx = await this.load(tenantId);
    return { ctx, period: this.period(q, ctx.tz) };
  }

  assertAdvanced(ctx: ReportContext): void {
    if (!ctx.ent.isOperational) {
      throw new AppError(HttpStatus.FORBIDDEN, 'SUBSCRIPTION_INACTIVE', 'Tu suscripción no está activa. Puedes consultar los reportes básicos.');
    }
    if (!ctx.advanced) {
      throw new AppError(HttpStatus.FORBIDDEN, 'FEATURE_NOT_IN_PLAN', `Reportes avanzados no está incluido en tu plan ${ctx.ent.plan.name}.`, {
        feature: 'advancedReports',
      });
    }
  }

  period(q: PeriodQueryDto, tz: string, now = new Date()): ResolvedPeriod {
    try {
      return resolvePeriod(q.period, tz, now, { from: q.from, to: q.to });
    } catch (error) {
      if (error instanceof PeriodError) {
        throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', error.message, { errors: { [error.field]: [error.message] } });
      }
      throw error;
    }
  }

  access(ctx: ReportContext) {
    return { advanced: ctx.advanced, plan: ctx.ent.plan.name, operational: ctx.ent.isOperational };
  }
}

export function periodView(p: ResolvedPeriod) {
  return {
    key: p.key,
    label: p.label,
    from: p.from,
    to: p.to,
    start: p.start,
    end: p.end,
    timezone: p.timezone,
    inProgress: p.inProgress,
    granularity: p.granularity,
    previous: { label: p.previous.label, from: p.previous.from, to: p.previous.to, start: p.previous.start, end: p.previous.comparedUntil },
  };
}
