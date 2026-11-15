import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentAuth, Public } from '../auth/decorators.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { RequireActiveSubscription, RequireFeature } from '../subscriptions/subscription.guard.js';
import { CurrentTenant, TenantRoles, TenantScoped } from '../tenancy/decorators.js';
import { CancelSaleDto, CartDto, CreateSaleDto, ListSalesQueryDto, PosProductsQueryDto } from './dto.js';
import { renderReceiptPdf } from './receipt-pdf.js';
import { SALE_CANCEL_ROLES, SalesService } from './sales.service.js';

async function sendPdf(res: Response, receipt: Parameters<typeof renderReceiptPdf>[0], filename: string) {
  const pdf = await renderReceiptPdf(receipt);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
}

@ApiTags('pos')
@TenantScoped()
@Controller('pos')
export class PosController {
  constructor(private readonly sales: SalesService) {}

  @Get('products')
  @ApiOperation({ summary: 'Prendas activas para vender (búsqueda por nombre, SKU, categoría, etiqueta, color o talla)' })
  products(@CurrentTenant() tenant: TenantContext, @Query() q: PosProductsQueryDto) {
    return this.sales.posProducts(tenant.tenantId, q);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Calcular importes con precios y stock actuales (no crea ventas ni descuenta stock)' })
  preview(@CurrentTenant() tenant: TenantContext, @Body() dto: CartDto) {
    return this.sales.preview(tenant.tenantId, dto);
  }
}

@ApiTags('sales')
@TenantScoped()
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  @ApiOperation({ summary: 'Historial de ventas (paginado; filtros por periodo, estado, método de pago y número)' })
  list(@CurrentTenant() tenant: TenantContext, @Query() q: ListSalesQueryDto) {
    return this.sales.list(tenant.tenantId, q);
  }

  @Post()
  @RequireFeature('inventoryAndSales')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Confirmar venta: valida stock y precios vigentes, numera, registra y descuenta inventario en una transacción. Idempotente.',
  })
  @ApiCreatedResponse({ description: 'Venta registrada (detalle)' })
  @ApiConflictResponse({ description: 'INSUFFICIENT_STOCK o PRODUCT_UNAVAILABLE' })
  @ApiForbiddenResponse({ description: 'SUBSCRIPTION_INACTIVE' })
  create(@CurrentTenant() tenant: TenantContext, @CurrentAuth() auth: AuthContext, @Body() dto: CreateSaleDto) {
    return this.sales.create(tenant.tenantId, auth.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de la venta con sus movimientos de inventario' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.sales.get(tenant.tenantId, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @TenantRoles(...SALE_CANCEL_ROLES)
  @RequireActiveSubscription()
  @ApiOperation({ summary: 'Anular venta (propietario): restituye stock; la devolución de dinero se gestiona aparte' })
  @ApiConflictResponse({ description: 'SALE_ALREADY_CANCELED' })
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CancelSaleDto,
  ) {
    return this.sales.cancel(tenant.tenantId, auth.userId, id, dto);
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Datos de la boleta digital (comprobante interno, no factura fiscal)' })
  receipt(@CurrentTenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.sales.receipt(tenant.tenantId, id);
  }

  @Get(':id/receipt/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Boleta en PDF (80 mm)' })
  async receiptPdf(@CurrentTenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response) {
    const receipt = await this.sales.receipt(tenant.tenantId, id);
    await sendPdf(res, receipt, `boleta-${receipt.number}.pdf`);
  }

  @Post(':id/receipt-link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Crear (o devolver) el enlace público aleatorio para compartir la boleta' })
  receiptLink(@CurrentTenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.sales.createReceiptLink(tenant.tenantId, id);
  }

  @Delete(':id/receipt-link')
  @TenantRoles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactivar el enlace público de la boleta' })
  @ApiNoContentResponse()
  async revokeReceiptLink(@CurrentTenant() tenant: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.sales.revokeReceiptLink(tenant.tenantId, id);
  }
}

/** Public, token-based receipt (shared with the customer). No session required. */
@ApiTags('receipts (public)')
@Public()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('receipts')
export class PublicReceiptsController {
  constructor(private readonly sales: SalesService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Boleta pública por enlace (token aleatorio y revocable)' })
  @ApiOkResponse({ description: 'Datos de la boleta, sin identificadores internos' })
  receipt(@Param('token') token: string) {
    return this.sales.publicReceipt(token);
  }

  @Get(':token/pdf')
  @ApiProduces('application/pdf')
  async pdf(@Param('token') token: string, @Res() res: Response) {
    const receipt = await this.sales.publicReceipt(token);
    await sendPdf(res, receipt, `boleta-${receipt.number}.pdf`);
  }
}
