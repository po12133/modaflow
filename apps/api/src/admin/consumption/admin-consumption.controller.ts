import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminDashboardService } from '../admin-dashboard.service.js';
import { AdminArea } from '../staff-roles.guard.js';
import { AI_PRICES_USD_PER_MTOK } from './ai-pricing.js';
import { AdminConsumptionService } from './admin-consumption.service.js';
import { AiLogQueryDto, ConsumptionQueryDto } from './dto.js';

@ApiTags('admin')
@AdminArea()
@Throttle({ default: { limit: 240, ttl: 60_000 } })
@Controller('admin/consumption')
export class AdminConsumptionController {
  constructor(
    private readonly consumption: AdminConsumptionService,
    private readonly dashboard: AdminDashboardService,
  ) {}

  private period(q: ConsumptionQueryDto) {
    const p = this.dashboard.period(q);
    return { p, view: { key: p.key, label: p.label, from: p.from, to: p.to } };
  }

  @Get()
  @ApiOperation({ summary: 'Consumo del periodo: IA (análisis, tokens y costo estimado en USD), productos e imágenes' })
  async summary(@Query() q: ConsumptionQueryDto) {
    const { p, view } = this.period(q);
    return { period: view, prices: AI_PRICES_USD_PER_MTOK, ...(await this.consumption.summary(p)) };
  }

  @Get('accounts')
  @ApiOperation({ summary: 'Consumo por cuenta en el periodo, ordenado por costo de IA' })
  async accounts(@Query() q: ConsumptionQueryDto) {
    const { p, view } = this.period(q);
    return { period: view, ...(await this.consumption.accounts(p, q.page ?? 1, q.pageSize ?? 20)) };
  }

  @Get('ai-log')
  @ApiOperation({ summary: 'Registro de análisis con IA: cuenta, usuario, modelo, tokens, costo y foto escaneada' })
  async aiLog(@Query() q: AiLogQueryDto) {
    const { p, view } = this.period(q);
    return { period: view, ...(await this.consumption.aiLog(p, q)) };
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Consumo histórico de una cuenta' })
  tenant(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.consumption.tenantUsage(id);
  }
}
