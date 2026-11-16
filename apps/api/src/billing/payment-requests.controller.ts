import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators.js';
import { AppError } from '../common/app-error.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { imageUpload } from '../images/image-upload.js';
import { CurrentTenant, TenantRoles, TenantScoped } from '../tenancy/decorators.js';
import { CreatePaymentRequestDto, PaymentInfoQueryDto } from './dto/payments.dto.js';
import { PaymentRequestsService } from './payment-requests.service.js';
import { PaymentInfoService } from './payment-info.service.js';

@ApiTags('subscription payments')
@TenantScoped()
@Controller('subscription')
export class PaymentRequestsController {
  constructor(
    private readonly payments: PaymentRequestsService,
    private readonly settings: PaymentInfoService,
  ) {}

  @Get('payment-info')
  @ApiOperation({ summary: 'Métodos de pago de ModaFlow disponibles (QR bancario y transferencia) e instrucciones' })
  info(@Query() q: PaymentInfoQueryDto) {
    return this.settings.paymentInfo(q.plan);
  }

  @Get('payment-requests')
  @ApiOperation({ summary: 'Historial de solicitudes de pago del negocio actual' })
  list(@CurrentTenant() t: TenantContext) {
    return this.payments.list(t.tenantId);
  }

  @Get('periods')
  @ApiOperation({ summary: 'Periodos cubiertos (prueba, activaciones, renovaciones)' })
  periods(@CurrentTenant() t: TenantContext) {
    return this.payments.periods(t.tenantId);
  }

  @Post('payment-requests')
  @TenantRoles('OWNER')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Crear una solicitud de pago para un plan (el importe sale del plan vigente, nunca del navegador)' })
  create(@CurrentTenant() t: TenantContext, @CurrentAuth() auth: AuthContext, @Body() dto: CreatePaymentRequestDto) {
    return this.payments.create(t.tenantId, auth.userId, dto);
  }

  @Get('payment-requests/:id')
  @ApiOperation({ summary: 'Detalle y estado de una solicitud de pago' })
  get(@CurrentTenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.payments.get(t.tenantId, id);
  }

  @Post('payment-requests/:id/receipt')
  @TenantRoles('OWNER')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(imageUpload)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir la imagen del comprobante (se guarda en S3)' })
  receipt(@CurrentTenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new AppError(HttpStatus.BAD_REQUEST, 'INVALID_IMAGE', 'Selecciona la imagen del comprobante.');
    return this.payments.uploadReceipt(t.tenantId, id, file.buffer);
  }

  @Post('payment-requests/:id/submit')
  @TenantRoles('OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar que se envió el comprobante (queda pendiente de revisión)' })
  submit(@CurrentTenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.payments.submit(t.tenantId, id);
  }

  @Post('payment-requests/:id/cancel')
  @TenantRoles('OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una solicitud pendiente' })
  cancel(@CurrentTenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.payments.cancel(t.tenantId, id);
  }
}
