import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CurrentAuth } from '../auth/decorators.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { TrimToNull } from '../common/validation.js';
import { CurrentTenant, TenantRoles, TenantScoped } from '../tenancy/decorators.js';
import { EntitlementsService } from './entitlements.service.js';
import { SubscriptionsService } from './subscriptions.service.js';

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
  @ApiProperty({ enum: ['TRIALING', 'ACTIVE', 'EXPIRED', 'CANCELED'] }) status!: string;
  @ApiProperty({ description: 'false => solo lectura: no se permiten operaciones nuevas' }) isOperational!: boolean;
  @ApiProperty() startedAt!: Date;
  @ApiProperty() expiresAt!: Date;
  @ApiProperty() daysRemaining!: number;
  @ApiPropertyOptional({ nullable: true, type: Date, description: 'Datos conservados hasta esta fecha tras vencer' })
  dataRetentionUntil!: Date | null;
  @ApiProperty({ type: LimitsDto }) limits!: LimitsDto;
  @ApiProperty({ type: FeaturesDto }) features!: FeaturesDto;
}

export class CreatePlanChangeRequestDto {
  @ApiProperty({ example: 'pro' })
  @IsString()
  @Matches(/^[a-z0-9_-]{2,32}$/)
  planCode!: string;

  @ApiPropertyOptional({ example: 'Quiero pagar por QR', nullable: true })
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class PlanChangeRequestDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELED'] }) status!: string;
  @ApiProperty() fromPlan!: string;
  @ApiProperty() toPlan!: string;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty() createdAt!: Date;
}

@ApiTags('subscription')
@TenantScoped()
@Controller('subscription')
export class SubscriptionsController {
  constructor(
    private readonly entitlements: EntitlementsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Plan actual, estado, días restantes, límites, consumo y funciones habilitadas' })
  @ApiOkResponse({ type: EntitlementsDto })
  get(@CurrentTenant() tenant: TenantContext): Promise<EntitlementsDto> {
    return this.entitlements.getForTenant(tenant.tenantId);
  }

  @Get('change-requests')
  @ApiOperation({ summary: 'Solicitudes de cambio de plan del tenant' })
  @ApiOkResponse({ type: [PlanChangeRequestDto] })
  listRequests(@CurrentTenant() tenant: TenantContext): Promise<PlanChangeRequestDto[]> {
    return this.subscriptions.listRequests(tenant.tenantId);
  }

  @Post('change-requests')
  @TenantRoles('OWNER')
  @ApiOperation({
    summary: 'Solicitar un cambio de plan (queda pendiente; no activa ni cobra el plan)',
  })
  @ApiCreatedResponse({ type: PlanChangeRequestDto })
  @ApiConflictResponse({ description: 'PENDING_REQUEST_EXISTS' })
  createRequest(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreatePlanChangeRequestDto,
  ): Promise<PlanChangeRequestDto> {
    return this.subscriptions.createRequest(tenant.tenantId, auth.userId, dto.planCode, dto.note ?? null);
  }

  @Delete('change-requests/:id')
  @TenantRoles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancelar una solicitud pendiente propia' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'REQUEST_NOT_FOUND' })
  async cancelRequest(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.subscriptions.cancelRequest(tenant.tenantId, id);
  }
}
