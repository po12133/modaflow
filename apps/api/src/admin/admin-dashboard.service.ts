import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buckets } from '../reports/report-buckets.js';
import type { ResolvedPeriod } from '../reports/report-period.types.js';
import { PeriodError, resolvePeriod } from '../reports/report-periods.js';
import { effectiveStatusWhere } from './admin-status-filter.js';
import { arpuCents, money, mrrCents, numericCents } from './admin-metrics.js';
import type { StatsQueryDto } from './dto.js';

const TZ = 'America/La_Paz';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  period(q: StatsQueryDto, now = new Date()): ResolvedPeriod {
    try {
      return resolvePeriod(q.period ?? 'this_month', TZ, now, { from: q.from, to: q.to });
    } catch (error) {
      if (error instanceof PeriodError) throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', error.message, { errors: { [error.field]: [error.message] } });
      throw error;
    }
  }

  async kpis(now = new Date()) {
    const month = resolvePeriod('this_month', TZ, now);
    const count = (status: 'TRIALING' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED', paid?: boolean) =>
      this.prisma.subscription.count({ where: { ...effectiveStatusWhere(status, now), ...(paid === undefined ? {} : { plan: { isTrial: !paid } }) } });
    const [tenants, trials, paidActive, expired, suspended, pending, monthRevenue, totalRevenue, paidRows] = await Promise.all([
      this.prisma.tenant.count(),
      count('TRIALING'),
      count('ACTIVE', true),
      count('EXPIRED'),
      count('SUSPENDED'),
      this.prisma.planChangeRequest.aggregate({ where: { status: 'PENDING', submittedAt: { not: null } }, _count: true, _sum: { amountExpected: true } }),
      this.prisma.planChangeRequest.aggregate({ where: { status: 'APPROVED', reviewedAt: { gte: month.start, lt: month.end } }, _sum: { amountConfirmed: true } }),
      this.prisma.planChangeRequest.aggregate({ where: { status: 'APPROVED' }, _sum: { amountConfirmed: true } }),
      this.prisma.subscription.findMany({ where: { ...effectiveStatusWhere('ACTIVE', now), plan: { isTrial: false } }, select: { planVersion: { select: { billingPeriod: true, durationDays: true, priceCents: true } } } }),
    ]);
    const mrr = mrrCents(paidRows.flatMap((r) => (r.planVersion ? [r.planVersion] : [])));
    return {
      tenants,
      activeTenants: trials + paidActive,
      trials,
      paidActive,
      expired,
      suspended,
      pendingPayments: { count: pending._count, amount: money(numericCents(pending._sum.amountExpected?.toFixed(2))) },
      revenueThisMonth: money(numericCents(monthRevenue._sum.amountConfirmed?.toFixed(2))),
      revenueTotal: money(numericCents(totalRevenue._sum.amountConfirmed?.toFixed(2))),
      mrr: money(mrr),
      arpu: (() => {
        const v = arpuCents(mrr, paidActive);
        return v === null ? null : money(v);
      })(),
    };
  }

  async charts(p: ResolvedPeriod) {
    const g = p.granularity;
    const series = (sql: Promise<{ key: string; value: string | number }[]>) => sql.then((rows) => new Map(rows.map((r) => [r.key, Number(r.value)])));
    const [revenue, tenants, conversions, renewals, cancellations, byPlan] = await Promise.all([
      series(this.prisma.$queryRaw`SELECT to_char(date_trunc(${g}::text, reviewed_at AT TIME ZONE ${TZ}), 'YYYY-MM-DD"T"HH24') AS key, sum(amount_confirmed)::text AS value
        FROM plan_change_requests WHERE status = 'APPROVED' AND reviewed_at >= ${p.start} AND reviewed_at < ${p.end} GROUP BY 1`),
      series(this.prisma.$queryRaw`SELECT to_char(date_trunc(${g}::text, created_at AT TIME ZONE ${TZ}), 'YYYY-MM-DD"T"HH24') AS key, count(*)::int AS value
        FROM tenants WHERE created_at >= ${p.start} AND created_at < ${p.end} GROUP BY 1`),
      this.prisma.$queryRaw<{ n: number }[]>`SELECT count(DISTINCT sp.tenant_id)::int AS n FROM subscription_periods sp
        WHERE sp.kind = 'ACTIVATION' AND sp.created_at >= ${p.start} AND sp.created_at < ${p.end}
          AND EXISTS (SELECT 1 FROM subscription_periods t WHERE t.tenant_id = sp.tenant_id AND t.kind = 'TRIAL')`,
      this.prisma.subscriptionPeriod.count({ where: { kind: 'RENEWAL', createdAt: { gte: p.start, lt: p.end } } }),
      this.prisma.subscriptionHistory.count({ where: { action: 'CANCELED', createdAt: { gte: p.start, lt: p.end } } }),
      this.prisma.$queryRaw<{ name: string; n: number }[]>`SELECT p.name, count(*)::int AS n FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.status IN ('TRIALING', 'ACTIVE') AND s.current_period_end > now() GROUP BY p.name, p.sort_order ORDER BY p.sort_order`,
    ]);
    const points = buckets(p.from, p.to, g).map((b) => ({ key: b.key, label: b.label, revenue: money(Math.round((revenue.get(b.key) ?? 0) * 100)), newTenants: tenants.get(b.key) ?? 0 }));
    return { granularity: g, points, conversions: conversions[0]?.n ?? 0, renewals, cancellations, subscriptionsByPlan: byPlan.map((r) => ({ plan: r.name, count: r.n })) };
  }
}
