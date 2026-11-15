import { Injectable } from '@nestjs/common';
import type { PeriodQueryDto } from './dto.js';
import { periodView, ReportContextService } from './report-context.service.js';
import { SalesStatsService } from './sales-stats.service.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly context: ReportContextService,
    private readonly stats: SalesStatsService,
  ) {}

  async summary(tenantId: string, q: PeriodQueryDto) {
    const { ctx, period } = await this.context.resolve(tenantId, q);
    const data = await this.stats.summary(ctx, period);
    return { store: ctx.storeName, period: periodView(period), ...data, access: this.context.access(ctx) };
  }

  async chart(tenantId: string, q: PeriodQueryDto) {
    const { ctx, period } = await this.context.resolve(tenantId, q);
    return this.stats.chart(ctx, period);
  }

  async categories(tenantId: string, q: PeriodQueryDto) {
    const { ctx, period } = await this.context.resolve(tenantId, q);
    return this.stats.categories(ctx, period);
  }

  async paymentMethods(tenantId: string, q: PeriodQueryDto) {
    const { ctx, period } = await this.context.resolve(tenantId, q);
    return this.stats.paymentMethods(ctx, period);
  }
}
