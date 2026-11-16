import { Injectable } from '@nestjs/common';
import { imageKeys } from '../../images/image-processing.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ResolvedPeriod } from '../../reports/report-period.types.js';
import { StorageService } from '../../storage/storage.service.js';
import { aiCostUsd, roundUsd } from './ai-pricing.js';
import { type AiUsageRow, byModel, groupBy, sumAiUsage } from './consumption-math.js';
import type { AiLogQueryDto } from './dto.js';

type TenantAi = AiUsageRow & { tenantId: string };
interface TenantCounts { tenantId: string; created: number; deleted: number; active: number }
interface TenantImages { tenantId: string; images: number; scanned: number; bytes: number }

@Injectable()
export class AdminConsumptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private aiRows(p: ResolvedPeriod | null, tenantId?: string) {
    const from = p?.start ?? new Date(0);
    const to = p?.end ?? new Date('9999-12-31');
    return this.prisma.$queryRaw<TenantAi[]>`
      SELECT tenant_id AS "tenantId", model,
        count(*) FILTER (WHERE status = 'SUCCEEDED')::int AS succeeded, count(*) FILTER (WHERE status = 'FAILED')::int AS failed,
        COALESCE(sum(input_tokens), 0)::float8 AS input, COALESCE(sum(output_tokens), 0)::float8 AS output
      FROM ai_analyses
      WHERE created_at >= ${from} AND created_at < ${to} AND (${tenantId ?? null}::uuid IS NULL OR tenant_id = ${tenantId ?? null}::uuid)
      GROUP BY tenant_id, model`;
  }

  private productRows(p: ResolvedPeriod | null, tenantId?: string) {
    const from = p?.start ?? new Date(0);
    const to = p?.end ?? new Date('9999-12-31');
    return this.prisma.$queryRaw<TenantCounts[]>`
      SELECT tenant_id AS "tenantId",
        count(*) FILTER (WHERE created_at >= ${from} AND created_at < ${to})::int AS created,
        count(*) FILTER (WHERE deleted_at >= ${from} AND deleted_at < ${to})::int AS deleted,
        count(*) FILTER (WHERE status = 'ACTIVE')::int AS active
      FROM products WHERE (${tenantId ?? null}::uuid IS NULL OR tenant_id = ${tenantId ?? null}::uuid) GROUP BY tenant_id`;
  }

  private imageRows(tenantId?: string) {
    return this.prisma.$queryRaw<TenantImages[]>`
      SELECT tenant_id AS "tenantId", count(*)::int AS images, count(*) FILTER (WHERE ai_scanned)::int AS scanned,
        COALESCE(sum(size_bytes), 0)::float8 AS bytes
      FROM product_images WHERE (${tenantId ?? null}::uuid IS NULL OR tenant_id = ${tenantId ?? null}::uuid) GROUP BY tenant_id`;
  }

  async summary(p: ResolvedPeriod) {
    const [ai, products, images] = await Promise.all([this.aiRows(p), this.productRows(p), this.imageRows()]);
    const sum = <T>(rows: T[], key: keyof T) => rows.reduce((n, r) => n + Number(r[key] ?? 0), 0);
    return {
      ai: sumAiUsage(ai),
      byModel: byModel(ai),
      products: { created: sum(products, 'created'), deleted: sum(products, 'deleted'), active: sum(products, 'active') },
      images: { total: sum(images, 'images'), aiScanned: sum(images, 'scanned'), bytes: sum(images, 'bytes') },
    };
  }

  async accounts(p: ResolvedPeriod, page: number, pageSize: number) {
    const [tenants, ai, products, images, sales] = await Promise.all([
      this.prisma.tenant.findMany({ select: { id: true, name: true, subscription: { select: { plan: { select: { name: true } } } } } }),
      this.aiRows(p),
      this.productRows(p),
      this.imageRows(),
      this.prisma.sale.groupBy({ by: ['tenantId'], where: { status: 'COMPLETED', createdAt: { gte: p.start, lt: p.end } }, _count: true }),
    ]);
    const aiBy = groupBy(ai);
    const productBy = new Map(products.map((r) => [r.tenantId, r]));
    const imageBy = new Map(images.map((r) => [r.tenantId, r]));
    const salesBy = new Map(sales.map((r) => [r.tenantId, r._count]));
    const rows = tenants
      .map((t) => {
        const usage = sumAiUsage(aiBy.get(t.id) ?? []);
        const pr = productBy.get(t.id);
        const img = imageBy.get(t.id);
        return {
          tenantId: t.id,
          name: t.name,
          plan: t.subscription?.plan.name ?? null,
          ai: usage,
          products: { created: pr?.created ?? 0, deleted: pr?.deleted ?? 0, active: pr?.active ?? 0 },
          images: { total: img?.images ?? 0, aiScanned: img?.scanned ?? 0, bytes: img?.bytes ?? 0 },
          sales: salesBy.get(t.id) ?? 0,
        };
      })
      .sort((a, b) => b.ai.costUsd - a.ai.costUsd || b.ai.analyses - a.ai.analyses || b.products.created - a.products.created || a.name.localeCompare(b.name));
    const total = rows.length;
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async tenantUsage(tenantId: string) {
    const [ai, products, images, sales] = await Promise.all([
      this.aiRows(null, tenantId),
      this.productRows(null, tenantId),
      this.imageRows(tenantId),
      this.prisma.sale.count({ where: { tenantId, status: 'COMPLETED' } }),
    ]);
    return {
      ai: sumAiUsage(ai),
      products: { created: products[0]?.created ?? 0, deleted: products[0]?.deleted ?? 0, active: products[0]?.active ?? 0 },
      images: { total: images[0]?.images ?? 0, aiScanned: images[0]?.scanned ?? 0, bytes: images[0]?.bytes ?? 0 },
      completedSales: sales,
    };
  }

  async aiLog(p: ResolvedPeriod, q: AiLogQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const where = { createdAt: { gte: p.start, lt: p.end }, ...(q.tenantId ? { tenantId: q.tenantId } : {}), ...(q.status ? { status: q.status } : {}) };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.aiAnalysis.count({ where }),
      this.prisma.aiAnalysis.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, status: true, model: true, imageIds: true, inputTokens: true, outputTokens: true, errorCode: true, creditsCharged: true, createdAt: true, completedAt: true,
          tenant: { select: { id: true, name: true } },
          user: { select: { name: true } },
          product: { select: { id: true, name: true, status: true } },
        },
      }),
    ]);
    const firstIds = rows.map((r) => r.imageIds[0]).filter((id): id is string => Boolean(id));
    const images = await this.prisma.productImage.findMany({ where: { id: { in: firstIds } }, select: { id: true, storageKey: true } });
    const thumbs = new Map(await Promise.all(images.map(async (i) => [i.id, await this.storage.fileUrl(imageKeys(i.storageKey).thumb).catch(() => null)] as const)));
    const items = rows.map((r) => {
      const cost = aiCostUsd(r.model, r.inputTokens ?? 0, r.outputTokens ?? 0);
      return {
        ...r,
        imageCount: r.imageIds.length,
        imageIds: undefined,
        thumbUrl: r.imageIds[0] ? (thumbs.get(r.imageIds[0]) ?? null) : null,
        costUsd: cost === null ? null : roundUsd(cost),
      };
    });
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }
}
