import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ImagesService } from '../images/images.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fromCents } from '../sales/sale-math.js';
import type { ProductSort, ProductsReportQueryDto } from './dto.js';
import { periodView, ReportContextService, type ReportContext } from './report-context.service.js';
import { decimalToCents, grossProfit, type CostRow } from './report-math.js';
import type { ResolvedPeriod } from './report-period.types.js';
import { SalesStatsService } from './sales-stats.service.js';

export type ProductFilters = Pick<ProductsReportQueryDto, 'categoryId' | 'productId' | 'variantId' | 'search' | 'sort'>;
type ProductRow = CostRow & { product_id: string; units: number; revenue: string; gross: string; sales: number; total_rows: number };

const ORDER: Record<ProductSort, Prisma.Sql> = {
  units_desc: Prisma.sql`sum(si.quantity) DESC, sum(si.net_total) DESC`,
  units_asc: Prisma.sql`sum(si.quantity) ASC, sum(si.net_total) ASC`,
  revenue_desc: Prisma.sql`sum(si.net_total) DESC, sum(si.quantity) DESC`,
  revenue_asc: Prisma.sql`sum(si.net_total) ASC, sum(si.quantity) ASC`,
};

@Injectable()
export class ProductStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImagesService,
    private readonly context: ReportContextService,
    private readonly stats: SalesStatsService,
  ) {}

  async report(tenantId: string, q: ProductsReportQueryDto) {
    const { ctx, period: p } = await this.context.resolve(tenantId, q);
    this.context.assertAdvanced(ctx);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const [result, variants, categories] = await Promise.all([
      this.rows(ctx, p, q, pageSize, (page - 1) * pageSize, true),
      this.topVariants(ctx, p, q),
      this.stats.categories(ctx, p),
    ]);
    return {
      store: ctx.storeName,
      period: periodView(p),
      sort: q.sort ?? 'units_desc',
      items: result.items,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
      variants,
      categories: categories.items,
    };
  }

  private filters(ctx: ReportContext, p: ResolvedPeriod, q: ProductFilters) {
    const search = q.search?.trim();
    return Prisma.sql`s.tenant_id = ${ctx.tenantId}::uuid AND si.tenant_id = ${ctx.tenantId}::uuid AND s.status = 'COMPLETED'
      AND s.created_at >= ${p.start} AND s.created_at < ${p.end}
      ${q.categoryId ? Prisma.sql`AND si.category_id = ${q.categoryId}::uuid` : Prisma.empty}
      ${q.productId ? Prisma.sql`AND si.product_id = ${q.productId}::uuid` : Prisma.empty}
      ${q.variantId ? Prisma.sql`AND si.variant_id = ${q.variantId}::uuid` : Prisma.empty}
      ${search ? Prisma.sql`AND si.product_name ILIKE ${`%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}` : Prisma.empty}`;
  }

  async rows(ctx: ReportContext, p: ResolvedPeriod, q: ProductFilters, limit: number, offset: number, withImages: boolean) {
    const rows = await this.prisma.$queryRaw<ProductRow[]>`
      SELECT si.product_id,
             sum(si.quantity)::int AS units,
             sum(si.net_total)::text AS revenue,
             sum(si.line_total)::text AS gross,
             count(DISTINCT si.sale_id)::int AS sales,
             sum(si.net_total) FILTER (WHERE si.unit_cost IS NOT NULL)::text AS known_revenue,
             sum(si.unit_cost * si.quantity)::text AS known_cost,
             coalesce(sum(si.quantity) FILTER (WHERE si.unit_cost IS NULL), 0)::int AS units_without_cost,
             sum(si.net_total) FILTER (WHERE si.unit_cost IS NULL)::text AS revenue_without_cost,
             count(*) OVER ()::int AS total_rows
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE ${this.filters(ctx, p, q)}
      GROUP BY si.product_id
      ORDER BY ${ORDER[q.sort ?? 'units_desc']}, si.product_id
      LIMIT ${limit} OFFSET ${offset}`;
    const ids = rows.map((r) => r.product_id);
    const [products, thumbs] = await Promise.all([
      this.prisma.product.findMany({
        where: { tenantId: ctx.tenantId, id: { in: ids } },
        select: { id: true, name: true, sku: true, status: true, category: { select: { name: true } } },
      }),
      withImages ? this.thumbnails(ctx.tenantId, ids) : new Map<string, string | null>(),
    ]);
    const byId = new Map(products.map((x) => [x.id, x]));
    return {
      total: rows[0]?.total_rows ?? 0,
      items: rows.map((r) => {
        const product = byId.get(r.product_id);
        const revenueCents = decimalToCents(r.revenue);
        return {
          productId: r.product_id,
          name: product?.name ?? '',
          sku: product?.sku ?? '',
          status: product?.status ?? 'ARCHIVED',
          category: product?.category?.name ?? null,
          thumbUrl: thumbs.get(r.product_id) ?? null,
          units: r.units,
          sales: r.sales,
          revenue: fromCents(revenueCents),
          grossSales: fromCents(decimalToCents(r.gross)),
          profit: grossProfit(revenueCents, r),
        };
      }),
    };
  }

  private async thumbnails(tenantId: string, productIds: string[]): Promise<Map<string, string | null>> {
    const thumbs = new Map<string, string | null>();
    if (productIds.length === 0) return thumbs;
    const images = await this.prisma.productImage.findMany({
      where: { tenantId, productId: { in: productIds }, isPrimary: true },
      select: { id: true, productId: true, storageKey: true, width: true, height: true, position: true, isPrimary: true },
    });
    await Promise.all(
      images.map(async (img) => {
        try {
          thumbs.set(img.productId!, (await this.images.toView(img)).thumbUrl);
        } catch {
          thumbs.set(img.productId!, null);
        }
      }),
    );
    return thumbs;
  }

  private async topVariants(ctx: ReportContext, p: ResolvedPeriod, q: ProductFilters) {
    const rows = await this.prisma.$queryRaw<
      { variant_id: string; product_id: string; product_name: string; sku: string; size: string | null; color: string | null; units: number; revenue: string }[]
    >`
      SELECT si.variant_id, si.product_id,
             (array_agg(si.product_name ORDER BY s.created_at DESC))[1] AS product_name,
             (array_agg(si.sku ORDER BY s.created_at DESC))[1] AS sku,
             (array_agg(si.size ORDER BY s.created_at DESC))[1] AS size,
             (array_agg(si.color ORDER BY s.created_at DESC))[1] AS color,
             sum(si.quantity)::int AS units, sum(si.net_total)::text AS revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE ${this.filters(ctx, p, q)}
      GROUP BY si.variant_id, si.product_id
      ORDER BY ${(q.sort ?? 'units_desc').startsWith('revenue') ? Prisma.sql`sum(si.net_total) DESC` : Prisma.sql`sum(si.quantity) DESC`}, si.variant_id
      LIMIT 10`;
    return rows.map((r) => ({
      variantId: r.variant_id,
      productId: r.product_id,
      productName: r.product_name,
      sku: r.sku,
      size: r.size,
      color: r.color,
      units: r.units,
      revenue: fromCents(decimalToCents(r.revenue)),
    }));
  }
}
