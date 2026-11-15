import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { CurrentTenant, TenantRoles, TenantScoped } from '../tenancy/decorators.js';
import { CreateProductDto, ListProductsQueryDto, UpdateProductDto } from './dto.js';
import { ProductsService } from './products.service.js';

@ApiTags('products')
@TenantScoped()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Productos de la tienda (paginado, búsqueda y filtros)' })
  @ApiOkResponse({ description: '{ items, total, page, pageSize, totalPages }' })
  list(@CurrentTenant() tenant: TenantContext, @Query() query: ListProductsQueryDto) {
    return this.products.list(tenant.tenantId, query);
  }

  @Post()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Registrar prenda con variantes y stock inicial (transaccional; respeta el límite del plan)',
  })
  @ApiCreatedResponse({ description: 'Detalle del producto creado' })
  @ApiForbiddenResponse({ description: 'PLAN_LIMIT_REACHED o SUBSCRIPTION_INACTIVE' })
  @ApiConflictResponse({ description: 'SKU_TAKEN o DUPLICATE_VARIANT' })
  create(@CurrentTenant() tenant: TenantContext, @CurrentAuth() auth: AuthContext, @Body() dto: CreateProductDto) {
    return this.products.create(tenant.tenantId, auth.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle del producto (variantes, fotos con URL firmada, etiquetas)' })
  @ApiNotFoundResponse({ description: 'PRODUCT_NOT_FOUND (también si pertenece a otra tienda)' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.products.get(tenant.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar producto, fotos y variantes (el stock solo cambia con movimientos de inventario)' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(tenant.tenantId, auth.userId, id, dto);
  }

  @Delete(':id')
  @TenantRoles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archivar producto (borrado lógico; conserva su historial)' })
  @ApiNoContentResponse()
  async archive(@CurrentTenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.products.archive(tenant.tenantId, id);
  }

  @Post(':id/restore')
  @TenantRoles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restaurar producto archivado (respeta el límite del plan)' })
  restore(@CurrentTenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.products.restore(tenant.tenantId, id);
  }
}
