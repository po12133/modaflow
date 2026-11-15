import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ResolvedPeriod } from '../reports/report-period.types.js';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { conversionPct, money, numericCents } from './admin-metrics.js';

const DAY_MS = 86_400_000;

@Injectable()
export class AdminStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: AdminDashboardService,
  ) {}

  async statistics(p: ResolvedPeriod) {
    const [kpis, charts, revenue, usage, conversion] = await Promise.all([this.dashboard.kpis(), this.dashboard.charts(p), this.revenue(p), this.usage(), this.conversion()]);
    return { period: { key: p.key, label: p.label, from: p.from, to: p.to }, kpis, charts, revenue, conversion, usage };
  }

  private async revenue(p: ResolvedPeriod) {
    const [byPlan, monthly, newSubs, periodRevenue] = await Promise.all([
      this.prisma.$queryRaw<{ plan: string; total: string; payments: number }[]>`SELECT pl.name AS plan, sum(r.amount_confirmed)::text AS total, count(*)::int AS payments
        FROM plan_change_requests r JOIN plans pl ON pl.id = r.to_plan_id
        WHERE r.status = 'APPROVED' AND r.reviewed_at >= ${p.start} AND r.reviewed_at < ${p.end} GROUP BY pl.name ORDER BY sum(r.amount_confirmed) DESC`,
      this.prisma.$queryRaw<{ month: string; total: string }[]>`SELECT to_char(date_trunc('month', reviewed_at AT TIME ZONE 'America/La_Paz'), 'YYYY-MM') AS month, sum(amount_confirmed)::text AS total
        FROM plan_change_requests WHERE status = 'APPROVED' AND reviewed_at >= now() - interval '12 months' GROUP BY 1 ORDER BY 1`,
      this.prisma.subscriptionPeriod.count({ where: { kind: { in: ['ACTIVATION', 'PLAN_CHANGE'] }, createdAt: { gte: p.start, lt: p.end } } }),
      this.prisma.planChangeRequest.aggregate({ where: { status: 'APPROVED', reviewedAt: { gte: p.start, lt: p.end } }, _sum: { amountConfirmed: true }, _count: true }),
    ]);
    return {
      inPeriod: money(numericCents(periodRevenue._sum.amountConfirmed?.toFixed(2))),
      paymentsInPeriod: periodRevenue._count,
      newSubscriptions: newSubs,
      byPlan: byPlan.map((r) => ({ plan: r.plan, total: money(numericCents(r.total)), payments: r.payments })),
      monthly: monthly.map((r) => ({ month: r.month, total: money(numericCents(r.total)) })),
    };
  }

  private async conversion() {
    const [users, trials, converted] = await Promise.all([
      this.prisma.user.count({ where: { globalRole: null } }),
      this.prisma.trialGrant.count(),
      this.prisma.$queryRaw<{ n: number }[]>`SELECT count(DISTINCT g.tenant_id)::int AS n FROM trial_grants g
        WHERE EXISTS (SELECT 1 FROM plan_change_requests r WHERE r.tenant_id = g.tenant_id AND r.status = 'APPROVED')`,
    ]);
    const n = converted[0]?.n ?? 0;
    return { registeredUsers: users, trialTenants: trials, convertedTenants: n, conversionPct: conversionPct(n, trials) };
  }

  private async usage() {
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [tenants, products, ai, sales, catalogs, requests, activeUsers] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.aiAnalysis.count({ where: { status: 'SUCCEEDED' } }),
      this.prisma.sale.count({ where: { status: 'COMPLETED' } }),
      this.prisma.store.count({ where: { products: { some: { catalogPublished: true, status: 'ACTIVE' } }, OR: [{ catalogSettings: null }, { catalogSettings: { status: 'PUBLISHED' } }] } }),
      this.prisma.catalogOrderRequest.count(),
      this.prisma.$queryRaw<{ n: number }[]>`SELECT count(DISTINCT user_id)::int AS n FROM sessions WHERE last_used_at >= ${since}`,
    ]);
    return { tenants, activeProducts: products, aiAnalyses: ai, salesRegistered: sales, catalogsWithProducts: catalogs, catalogRequests: requests, activeUsers30d: activeUsers[0]?.n ?? 0 };
  }
}
