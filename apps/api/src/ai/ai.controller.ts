import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID, Matches } from 'class-validator';
import { CurrentAuth } from '../auth/decorators.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { RequireActiveSubscription } from '../subscriptions/subscription.guard.js';
import { CurrentTenant, TenantScoped } from '../tenancy/decorators.js';
import { AiService, MAX_IMAGES_PER_ANALYSIS } from './ai.service.js';

class AnalyzeGarmentDto {
  @ApiProperty({ type: [String], description: `Fotos ya subidas de UNA prenda (1 a ${MAX_IMAGES_PER_ANALYSIS})` })
  @IsArray()
  @ArrayMinSize(1, { message: 'Sube al menos una foto.' })
  @ArrayMaxSize(MAX_IMAGES_PER_ANALYSIS, { message: `Analiza hasta ${MAX_IMAGES_PER_ANALYSIS} fotos por prenda.` })
  @IsUUID('4', { each: true })
  imageIds!: string[];

  @ApiProperty({ description: 'Clave única por análisis: un reintento no descuenta otro crédito' })
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  idempotencyKey!: string;
}

@ApiTags('ai')
@TenantScoped()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('analyze-garment')
  @HttpCode(HttpStatus.OK)
  @RequireActiveSubscription()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Analizar fotos de una prenda con Claude (1 crédito por análisis; no se cobra si falla). Devuelve sugerencias editables, nunca precios.',
  })
  @ApiOkResponse({ description: '{ id, status, suggestion, creditsCharged, usage }' })
  @ApiForbiddenResponse({ description: 'PLAN_LIMIT_REACHED o SUBSCRIPTION_INACTIVE' })
  @ApiConflictResponse({ description: 'ANALYSIS_IN_PROGRESS' })
  @ApiServiceUnavailableResponse({ description: 'AI_NOT_CONFIGURED, STORAGE_NOT_CONFIGURED o AI_UNAVAILABLE' })
  analyze(@CurrentTenant() tenant: TenantContext, @CurrentAuth() auth: AuthContext, @Body() dto: AnalyzeGarmentDto) {
    return this.ai.analyzeGarment(tenant.tenantId, auth.userId, dto.imageIds, dto.idempotencyKey);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Créditos de IA: límite, usados, disponibles, periodo y últimos análisis' })
  usage(@CurrentTenant() tenant: TenantContext) {
    return this.ai.usage(tenant.tenantId);
  }
}
