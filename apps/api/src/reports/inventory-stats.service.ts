import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { fromCents } from '../sales/sale-math.js';
import type { InventoryReportQueryDto } from './dto.js';
import { periodView, ReportContextService, type ReportContext } from './report-context.service.js';
import { decimalToCents } from './report-math.js';
import type { ResolvedPeriod } from './report-period.types.js';

export const MOVEMENT_TYPES = ['INITIAL', 'STOCK_IN', 'MANUAL_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'SALE', 'SALE_CANCEL'] as const;
export type LowStockOptions = Pick<InventoryReportQueryDto, 'lowStock' | 'includeUnique'>;

interface LowStockRow {
  id: string;
  name: string;
  sku: string;
  stock: number;
  threshold: number;
  category: string | null;
  is_unique: boolean;
  total_rows: number;
  unique_count: number;
}

@Injectable()
export class InventoryStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: ReportContextService,
  ) {}

  async report(tenantId: string, q: InventoryReportQueryDto) {
    const { ctx, period } = await this.context.resolve(tenantId, q);
    return this.build(ctx, period, q);
  }

  async build(ctx: ReportContext, p: ResolvedPeriod, q: LowStockOptions, lowStockLimit = 50) {
    const [stockRows, low, advanced] = await Promise.all([
      this.prisma.$queryRaw<{ active_products: number; units: number; out_of_stock: number }[]>`
        SELECT count(*)::int AS active_products, coalesce(sum(total_stock), 0)::int AS units,
               count(*) FILTER (WHERE total_stock = 0)::int AS out_of_stock
        FROM products WHERE tenant_id = ${ctx.tenantId}::uuid AND status = 'ACTIVE'`,
      this.lowStock(ctx.tenantId, q.lowStock ?? null, q.includeUnique ?? false, lowStockLimit),
      ctx.advanced ? this.advanced(ctx, p) : null,
    ]);
    const stock = stockRows[0];
    return {
      store: ctx.storeName,
      period: periodView(p),
      stock: { activeProducts: stock?.active_products ?? 0, units: stock?.units ?? 0, outOfStock: stock?.out_of_stock ?? 0 },
      lowStock: low,
      value: advanced?.value ?? null,
      movements: advanced?.movements ?? null,
      access: this.context.access(ctx),
    };
  }

  private async advanced(ctx: ReportContext, p: ResolvedPeriod) {
    const [valueRows, movementRows] = await Promise.all([
      this.prisma.$queryRaw<{ cost_value: string | null; retail_value: string | null; units_without_cost: number; products_without_cost: number }[]>`
        SELECT sum(total_stock * purchase_price) FILTER (WHERE purchase_price IS NOT NULL)::text AS cost_value,
               sum(total_stock * sale_price)::text AS retail_value,
               coalesce(sum(total_stock) FILTER (WHERE purchase_price IS NULL), 0)::int AS units_without_cost,
               count(*) FILTER (WHERE purchase_price IS NULL AND total_stock > 0)::int AS products_without_cost
        FROM products WHERE tenant_id = ${ctx.tenantId}::uuid AND status = 'ACTIVE'`,
      this.prisma.$queryRaw<{ type: string; movements: number; units: number }[]>`
        SELECT type::text AS type, count(*)::int AS movements, coalesce(sum(quantity), 0)::int AS units
        FROM inventory_movements
        WHERE tenant_id = ${ctx.tenantId}::uuid AND created_at >= ${p.start} AND created_at < ${p.end}
        GROUP BY type`,
    ]);
    const v = valueRows[0];
    const byType = new Map(movementRows.map((m) => [m.type, m]));
    return {
      value: {
        costValue: fromCents(decimalToCents(v?.cost_value)),
        retailValue: fromCents(decimalToCents(v?.retail_value)),
        unitsWithoutCost: v?.units_without_cost ?? 0,
        productsWithoutCost: v?.products_without_cost ?? 0,
        complete: (v?.units_without_cost ?? 0) === 0,
      },
      movements: MOVEMENT_TYPES.map((type) => ({ type, movements: byType.get(type)?.movements ?? 0, units: byType.get(type)?.units ?? 0 })),
    };
  }

  async lowStock(tenantId: string, threshold: number | null, includeUnique: boolean, limit: number) {
    const rows = await this.prisma.$queryRaw<LowStockRow[]>`
      WITH candidates AS (
        SELECT p.id, p.name, p.sku, p.total_stock AS stock, p.low_stock_threshold AS threshold, c.name AS category,
               (p.total_stock = 1
                 AND (SELECT count(*) FROM product_variants v WHERE v.product_id = p.id) = 1
                 AND (SELECT bool_and(v.size IS NULL) FROM product_variants v WHERE v.product_id = p.id)
                 AND (SELECT coalesce(sum(m.quantity), 0) FROM inventory_movements m
                      WHERE m.product_id = p.id AND m.type IN ('INITIAL', 'STOCK_IN', 'ADJUSTMENT_IN')) <= 1) AS is_unique
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.tenant_id = ${tenantId}::uuid AND p.status = 'ACTIVE' AND p.total_stock > 0 AND p.low_stock_threshold > 0
          AND p.total_stock <= coalesce(${threshold}::int, p.low_stock_threshold)
      ),
      counts AS (SELECT count(*) FILTER (WHERE is_unique)::int AS unique_count FROM candidates)
      SELECT candidates.*, counts.unique_count, count(*) OVER ()::int AS total_rows
      FROM candidates, counts
      WHERE ${includeUnique} OR NOT is_unique
      ORDER BY stock ASC, name ASC
      LIMIT ${limit}`;
    const uniqueCount = rows[0]?.unique_count ?? (includeUnique ? 0 : await this.uniqueCount(tenantId, threshold));
    return {
      threshold,
      total: rows[0]?.total_rows ?? 0,
      uniqueExcluded: includeUnique ? 0 : uniqueCount,
      items: rows.map((r) => ({ id: r.id, name: r.name, sku: r.sku, stock: r.stock, threshold: r.threshold, category: r.category, unique: r.is_unique })),
    };
  }

  private async uniqueCount(tenantId: string, threshold: number | null): Promise<number> {
    const all = await this.lowStock(tenantId, threshold, true, 1);
    return all.total;
  }
}
