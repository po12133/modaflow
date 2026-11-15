import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import type { TenantContext } from '../common/request-context.js';
import { CurrentTenant, TenantScoped } from '../tenancy/decorators.js';
import { EntitlementsService } from './entitlements.service.js';

class LimitDto {
  @ApiProperty() limit!: number;
  @ApiProperty() used!: number;
}
class AiLimitDto extends LimitDto {
  @ApiProperty({ enum: ['TOTAL', 'MONTHLY'] }) period!: string;
  @ApiProperty() periodStart!: Date;
  @ApiProperty() periodEnd!: Date;
}
class LimitsDto {
  @ApiProperty({ type: LimitDto }) products!: LimitDto;
  @ApiProperty({ type: AiLimitDto }) aiAnalyses!: AiLimitDto;
  @ApiProperty({ type: LimitDto }) users!: LimitDto;
  @ApiProperty({ type: LimitDto }) branches!: LimitDto;
}
class FeaturesDto {
  @ApiProperty() inventoryAndSales!: boolean;
  @ApiProperty() advancedReports!: boolean;
  @ApiProperty() onlineCatalog!: boolean;
  @ApiProperty() advancedManagement!: boolean;
}
class CurrentPlanDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isTrial!: boolean;
  @ApiProperty() priceCents!: number;
  @ApiProperty({ enum: ['TRIAL', 'MONTHLY'] }) billingPeriod!: string;
}
export class EntitlementsDto {
  @ApiProperty({ type: CurrentPlanDto }) plan!: CurrentPlanDto;
  @ApiProperty({ enum: ['TRIALING', 'ACTIVE', 'EXPIRED', 'CANCELED', 'SUSPENDED'] }) status!: string;
  @ApiProperty({ description: 'false => solo lectura: no se permiten operaciones nuevas' }) isOperational!: boolean;
  @ApiProperty() startedAt!: Date;
  @ApiProperty() expiresAt!: Date;
  @ApiProperty() daysRemaining!: number;
  @ApiPropertyOptional({ nullable: true, type: Date, description: 'Datos conservados hasta esta fecha tras vencer' })
  dataRetentionUntil!: Date | null;
  @ApiProperty({ type: LimitsDto }) limits!: LimitsDto;
  @ApiProperty({ type: FeaturesDto }) features!: FeaturesDto;
}

@ApiTags('subscription')
@TenantScoped()
@Controller('subscription')
export class SubscriptionsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get()
  @ApiOperation({ summary: 'Plan actual, estado, días restantes, límites, consumo y funciones habilitadas' })
  @ApiOkResponse({ type: EntitlementsDto })
  get(@CurrentTenant() tenant: TenantContext): Promise<EntitlementsDto> {
    return this.entitlements.getForTenant(tenant.tenantId);
  }
}
