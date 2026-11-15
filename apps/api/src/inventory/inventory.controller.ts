import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { CurrentTenant, TenantRoles, TenantScoped } from '../tenancy/decorators.js';
import { InventoryQueryDto, MovementsQueryDto, StockAdjustmentDto, StockEntryDto, StockExitDto } from './dto.js';
import { InventoryService, type MovementInput } from './inventory.service.js';

function movementInput(dto: StockEntryDto | StockExitDto | StockAdjustmentDto, type: MovementInput['type']): MovementInput {
  return {
    variantId: dto.variantId,
    type,
    quantity: dto.quantity,
    reason: dto.reason ?? null,
    reference: dto.reference ?? null,
    idempotencyKey: dto.idempotencyKey,
  };
}

@ApiTags('inventory')
@TenantScoped()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'Stock por producto y variante, con totales (unidades, stock bajo, agotados)' })
  @ApiOkResponse({ description: '{ summary, items, total, page, pageSize, totalPages }' })
  stock(@CurrentTenant() tenant: TenantContext, @Query() query: InventoryQueryDto) {
    return this.inventory.stock(tenant.tenantId, query);
  }

  @Get('movements')
  @ApiOperation({ summary: 'Historial de movimientos (filtros por producto, variante, tipo y fechas)' })
  movements(@CurrentTenant() tenant: TenantContext, @Query() query: MovementsQueryDto) {
    return this.inventory.movements(tenant.tenantId, query);
  }

  @Post('entries')
  @ApiOperation({ summary: 'Entrada de mercadería' })
  @ApiCreatedResponse({ description: 'Movimiento registrado' })
  entry(@CurrentTenant() tenant: TenantContext, @CurrentAuth() auth: AuthContext, @Body() dto: StockEntryDto) {
    return this.inventory.move(tenant.tenantId, auth.userId, movementInput(dto, 'STOCK_IN'));
  }

  @Post('exits')
  @ApiOperation({ summary: 'Salida manual (con motivo)' })
  @ApiCreatedResponse({ description: 'Movimiento registrado' })
  @ApiConflictResponse({ description: 'INSUFFICIENT_STOCK' })
  exit(@CurrentTenant() tenant: TenantContext, @CurrentAuth() auth: AuthContext, @Body() dto: StockExitDto) {
    return this.inventory.move(tenant.tenantId, auth.userId, movementInput(dto, 'MANUAL_OUT'));
  }

  @Post('adjustments')
  @TenantRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Ajuste positivo o negativo (propietario o administrador, con motivo)' })
  @ApiCreatedResponse({ description: 'Movimiento registrado' })
  @ApiConflictResponse({ description: 'INSUFFICIENT_STOCK' })
  adjust(@CurrentTenant() tenant: TenantContext, @CurrentAuth() auth: AuthContext, @Body() dto: StockAdjustmentDto) {
    return this.inventory.move(
      tenant.tenantId,
      auth.userId,
      movementInput(dto, dto.direction === 'IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT'),
    );
  }
}
