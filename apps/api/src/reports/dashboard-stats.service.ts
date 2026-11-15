import { Injectable } from '@nestjs/common';
import { tenantTimezone } from '../common/tenant-timezone.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { periodRange } from '../sales/sale-dates.js';
import { formatSaleNumber } from '../sales/sale-math.js';
import { InventoryStatsService } from './inventory-stats.service.js';
import { SalesStatsService } from './sales-stats.service.js';

@Injectable()
export class DashboardStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: SalesStatsService,
    private readonly inventory: InventoryStatsService,
  ) {}

  async summary(tenantId: string) {
    const tz = await tenantTimezone(this.prisma, tenantId);
    const now = new Date();
    const day = periodRange('today', now, undefined, undefined, tz);
    const month = periodRange('month', now, undefined, undefined, tz);
    const [today, monthKpis, recent, low] = await Promise.all([
      this.stats.kpis(tenantId, day.gte!, day.lt!),
      this.stats.kpis(tenantId, month.gte!, month.lt!),
      this.prisma.sale.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, number: true, total: true, unitCount: true, paymentMethod: true, status: true, createdAt: true },
      }),
      this.inventory.lowStock(tenantId, null, false, 5),
    ]);
    return {
      today: { sales: today.sales, total: today.total, units: today.units },
      month: { sales: monthKpis.sales, total: monthKpis.total, units: monthKpis.units },
      recent: recent.map((s) => ({ ...s, number: formatSaleNumber(s.number), total: s.total.toFixed(2) })),
      lowStock: { total: low.total, items: low.items },
    };
  }
}
