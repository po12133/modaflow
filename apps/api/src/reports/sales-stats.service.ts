import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fromCents } from '../sales/sale-math.js';
import { bucketStart, buckets, percentChange } from './report-buckets.js';
import { periodView, type ReportContext } from './report-context.service.js';
import { decimalToCents, grossProfit, toKpis, type CostRow, type Kpis, type KpiRow } from './report-math.js';
import type { ResolvedPeriod } from './report-period.types.js';

@Injectable()
export class SalesStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async kpis(tenantId: string, start: Date, end: Date, extra: Prisma.Sql = Prisma.empty): Promise<Kpis> {
    const rows = await this.prisma.$queryRaw<KpiRow[]>`
      SELECT count(*) FILTER (WHERE status = 'COMPLETED')::int AS sales,
             coalesce(sum(unit_count) FILTER (WHERE status = 'COMPLETED'), 0)::int AS units,
             sum(total) FILTER (WHERE status = 'COMPLETED')::text AS total,
             sum(subtotal) FILTER (WHERE status = 'COMPLETED')::text AS subtotal,
             sum(items_discount) FILTER (WHERE status = 'COMPLETED')::text AS items_discount,
             sum(discount_amount) FILTER (WHERE status = 'COMPLETED')::text AS general_discount,
             count(*) FILTER (WHERE status = 'CANCELED')::int AS canceled_sales,
             sum(total) FILTER (WHERE status = 'CANCELED')::text AS canceled_total
      FROM sales
      WHERE tenant_id = ${tenantId}::uuid AND created_at >= ${start} AND created_at < ${end} ${extra}`;
    return toKpis(rows[0]);
  }

  private async costs(tenantId: string, start: Date, end: Date): Promise<CostRow | undefined> {
    const rows = await this.prisma.$queryRaw<CostRow[]>`
      SELECT sum(si.net_total) FILTER (WHERE si.unit_cost IS NOT NULL)::text AS known_revenue,
             sum(si.unit_cost * si.quantity)::text AS known_cost,
             coalesce(sum(si.quantity) FILTER (WHERE si.unit_cost IS NULL), 0)::int AS units_without_cost,
             sum(si.net_total) FILTER (WHERE si.unit_cost IS NULL)::text AS revenue_without_cost
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.tenant_id = ${tenantId}::uuid AND si.tenant_id = ${tenantId}::uuid AND s.status = 'COMPLETED'
        AND s.created_at >= ${start} AND s.created_at < ${end}`;
    return rows[0];
  }

  async summary(ctx: ReportContext, p: ResolvedPeriod) {
    const kpis = await this.kpis(ctx.tenantId, p.start, p.end);
    if (!ctx.advanced) return { kpis, profit: null, comparison: null };
    const [costs, previous] = await Promise.all([
      this.costs(ctx.tenantId, p.start, p.end),
      this.kpis(ctx.tenantId, p.previous.start, p.previous.comparedUntil),
    ]);
    const comparison = {
      previous: { label: p.previous.label, from: p.previous.from, to: p.previous.to, until: p.previous.comparedUntil, kpis: previous },
      partial: p.inProgress,
      rule: p.inProgress
        ? 'El periodo está en curso: se compara con el mismo tiempo transcurrido del periodo anterior.'
        : 'Se compara con el periodo anterior completo de la misma duración.',
      changes: {
        total: percentChange(decimalToCents(kpis.total), decimalToCents(previous.total)),
        sales: percentChange(kpis.sales, previous.sales),
        units: percentChange(kpis.units, previous.units),
        averageTicket: percentChange(decimalToCents(kpis.averageTicket), decimalToCents(previous.averageTicket)),
      },
    };
    return { kpis, profit: grossProfit(decimalToCents(kpis.total), costs), comparison };
  }

  async chart(ctx: ReportContext, p: ResolvedPeriod) {
    const series = (start: Date, end: Date) => this.prisma.$queryRaw<{ key: string; sales: number; units: number; total: string }[]>`
      SELECT to_char(date_trunc(${p.granularity}::text, created_at AT TIME ZONE ${ctx.tz}), 'YYYY-MM-DD"T"HH24') AS key,
             count(*)::int AS sales, sum(unit_count)::int AS units, sum(total)::text AS total
      FROM sales
      WHERE tenant_id = ${ctx.tenantId}::uuid AND status = 'COMPLETED' AND created_at >= ${start} AND created_at < ${end}
      GROUP BY 1`;
    const [current, previous] = await Promise.all([series(p.start, p.end), series(p.previous.start, p.previous.end)]);
    const byKey = new Map(current.map((r) => [r.key, r]));
    const prevByKey = new Map(previous.map((r) => [r.key, r]));
    const prevBuckets = buckets(p.previous.from, p.previous.to, p.granularity);
    const now = Date.now();
    const points = buckets(p.from, p.to, p.granularity).map((b, i) => {
      const future = bucketStart(b.key, ctx.tz).getTime() > now;
      const row = byKey.get(b.key);
      const prevKey = prevBuckets[i]?.key;
      return {
        key: b.key,
        label: b.label,
        total: future ? null : fromCents(decimalToCents(row?.total)),
        sales: future ? null : (row?.sales ?? 0),
        units: future ? null : (row?.units ?? 0),
        previousTotal: prevKey ? fromCents(decimalToCents(prevByKey.get(prevKey)?.total)) : null,
      };
    });
    return { period: periodView(p), granularity: p.granularity, points };
  }

  async categories(ctx: ReportContext, p: ResolvedPeriod) {
    const rows = await this.prisma.$queryRaw<{ category_id: string | null; name: string | null; units: number; revenue: string }[]>`
      SELECT si.category_id,
             (array_agg(si.category_name ORDER BY s.created_at DESC))[1] AS name,
             sum(si.quantity)::int AS units, sum(si.net_total)::text AS revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.tenant_id = ${ctx.tenantId}::uuid AND si.tenant_id = ${ctx.tenantId}::uuid AND s.status = 'COMPLETED'
        AND s.created_at >= ${p.start} AND s.created_at < ${p.end}
      GROUP BY si.category_id
      ORDER BY sum(si.net_total) DESC, si.category_id`;
    return {
      period: periodView(p),
      items: rows.map((r) => ({ categoryId: r.category_id, name: r.name ?? 'Sin categoría', units: r.units, revenue: fromCents(decimalToCents(r.revenue)) })),
    };
  }

  async paymentMethods(ctx: ReportContext, p: ResolvedPeriod) {
    const rows = await this.prisma.$queryRaw<{ method: string; sales: number; total: string }[]>`
      SELECT payment_method::text AS method, count(*)::int AS sales, sum(total)::text AS total
      FROM sales
      WHERE tenant_id = ${ctx.tenantId}::uuid AND status = 'COMPLETED' AND created_at >= ${p.start} AND created_at < ${p.end}
      GROUP BY payment_method
      ORDER BY sum(total) DESC`;
    return { period: periodView(p), items: rows.map((r) => ({ method: r.method, sales: r.sales, total: fromCents(decimalToCents(r.total)) })) };
  }
}
