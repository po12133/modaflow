import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseSaleNumber } from '../sales/sale-math.js';
import type { SalesReportQueryDto } from './dto.js';
import { periodView, ReportContextService, type ReportContext } from './report-context.service.js';
import type { ResolvedPeriod } from './report-period.types.js';
import { SALE_ROW_SELECT, toSaleRow, type SaleRowRecord } from './sale-rows.js';
import { SalesStatsService } from './sales-stats.service.js';

export type SalesFilters = Pick<SalesReportQueryDto, 'paymentMethod' | 'sellerId' | 'status' | 'number'>;

@Injectable()
export class SalesTableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: ReportContextService,
    private readonly stats: SalesStatsService,
  ) {}

  private where(ctx: ReportContext, p: ResolvedPeriod, q: SalesFilters) {
    const number = q.number ? parseSaleNumber(q.number) : null;
    const where: Prisma.SaleWhereInput = {
      tenantId: ctx.tenantId,
      createdAt: { gte: p.start, lt: p.end },
      ...(q.paymentMethod ? { paymentMethod: q.paymentMethod } : {}),
      ...(q.sellerId ? { sellerId: q.sellerId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.number ? { number: number ?? -1 } : {}),
    };
    const extra = Prisma.sql`${q.paymentMethod ? Prisma.sql`AND payment_method = ${q.paymentMethod}::"PaymentMethod"` : Prisma.empty}
      ${q.sellerId ? Prisma.sql`AND seller_id = ${q.sellerId}::uuid` : Prisma.empty}
      ${q.number ? Prisma.sql`AND number = ${number ?? -1}` : Prisma.empty}`;
    return { where, extra };
  }

  async report(tenantId: string, q: SalesReportQueryDto) {
    const { ctx, period: p } = await this.context.resolve(tenantId, q);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const { where, extra } = this.where(ctx, p, q);
    const [rows, total, kpis, sellers] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        orderBy: [{ createdAt: q.sort ?? 'desc' }, { id: q.sort ?? 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: SALE_ROW_SELECT,
      }),
      this.prisma.sale.count({ where }),
      this.stats.kpis(tenantId, p.start, p.end, extra),
      this.sellers(tenantId),
    ]);
    return {
      store: ctx.storeName,
      period: periodView(p),
      kpis,
      sellers,
      items: rows.map(toSaleRow),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      access: this.context.access(ctx),
    };
  }

  async *batches(ctx: ReportContext, p: ResolvedPeriod, q: SalesFilters, batchSize = 1000) {
    const { where } = this.where(ctx, p, q);
    let cursor: { createdAt: Date; id: string } | null = null;
    for (;;) {
      const after: Prisma.SaleWhereInput | undefined = cursor
        ? { OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }] }
        : undefined;
      const rows: SaleRowRecord[] = await this.prisma.sale.findMany({
        where: after ? { AND: [where, after] } : where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: batchSize,
        select: SALE_ROW_SELECT,
      });
      if (rows.length === 0) return;
      yield rows.map(toSaleRow);
      if (rows.length < batchSize) return;
      const last: SaleRowRecord = rows[rows.length - 1]!;
      cursor = { createdAt: last.createdAt, id: last.id };
    }
  }

  private async sellers(tenantId: string) {
    const members = await this.prisma.tenantMembership.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: { id: true, name: true } } },
    });
    return members.map((m) => m.user);
  }
}
