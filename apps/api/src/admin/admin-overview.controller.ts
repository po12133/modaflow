import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SubscriptionExpiryService } from './jobs/subscription-expiry.service.js';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { AdminStatsService } from './admin-stats.service.js';
import { AuditQueryDto, PageQueryDto, StatsQueryDto } from './dto.js';
import { AdminArea, SuperadminOnly } from './staff-roles.guard.js';

@ApiTags('admin')
@AdminArea()
@Throttle({ default: { limit: 240, ttl: 60_000 } })
@Controller('admin')
export class AdminOverviewController {
  constructor(
    private readonly dashboard: AdminDashboardService,
    private readonly stats: AdminStatsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly expiry: SubscriptionExpiryService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Indicadores de ModaFlow (cobrado, pendiente, MRR) y series del periodo' })
  async overview(@Query() q: StatsQueryDto) {
    const period = this.dashboard.period(q);
    const [kpis, charts] = await Promise.all([this.dashboard.kpis(), this.dashboard.charts(period)]);
    return { period: { key: period.key, label: period.label, from: period.from, to: period.to }, kpis, charts };
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Ingresos, suscripciones, conversión, MRR, ARPU y uso agregado de la plataforma' })
  statistics(@Query() q: StatsQueryDto) {
    return this.stats.statistics(this.dashboard.period(q));
  }

  @Get('audit')
  @ApiOperation({ summary: 'Registro de auditoría (solo lectura)' })
  auditLog(@Query() q: AuditQueryDto) {
    return this.audit.list(q);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Notificaciones para el equipo de ModaFlow' })
  listNotifications(@Query() q: PageQueryDto) {
    return this.notifications.listForAdmin(q.page ?? 1);
  }

  @Post('notifications/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async readNotification(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.notifications.markRead({ audience: 'ADMIN' }, id);
  }

  @Post('jobs/subscription-expiry')
  @SuperadminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ejecutar ahora el proceso de vencimientos (también corre cada 10 minutos)' })
  runExpiry() {
    return this.expiry.run(new Date());
  }
}
