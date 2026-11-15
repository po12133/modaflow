import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TenantContext } from '../common/request-context.js';
import { CurrentTenant, TenantRoles, TenantScoped } from '../tenancy/decorators.js';
import { StoreDto, UpdateStoreDto } from './dto.js';
import { StoresService } from './stores.service.js';

@ApiTags('stores')
@TenantScoped()
@Controller('stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get('current')
  @ApiOperation({ summary: 'Tienda del tenant activo' })
  @ApiOkResponse({ type: StoreDto })
  @ApiNotFoundResponse({ description: 'STORE_NOT_FOUND' })
  getCurrent(@CurrentTenant() tenant: TenantContext): Promise<StoreDto> {
    return this.stores.getCurrent(tenant.tenantId);
  }

  @Put('current')
  @TenantRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Actualizar la configuración de la tienda (propietario o administrador)' })
  @ApiOkResponse({ type: StoreDto })
  updateCurrent(@CurrentTenant() tenant: TenantContext, @Body() dto: UpdateStoreDto): Promise<StoreDto> {
    return this.stores.updateCurrent(tenant.tenantId, dto);
  }
}
