import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentAuth } from '../auth/decorators.js';
import { ApprovePaymentDto, ListPaymentsQueryDto, RejectPaymentDto } from '../billing/dto/payments.dto.js';
import { UpdatePlatformSettingsDto } from '../billing/dto/settings.dto.js';
import { imageUpload } from '../billing/payment-requests.controller.js';
import { PaymentReviewService } from '../billing/payment-review.service.js';
import { PlatformSettingsService } from '../billing/platform-settings.service.js';
import { AppError } from '../common/app-error.js';
import { clientIp } from '../common/client-ip.js';
import type { AuthContext } from '../common/request-context.js';
import { AdminPlansService } from './admin-plans.service.js';
import { AdminSubscriptionsService } from './admin-subscriptions.service.js';
import { ChangePlanDto, ExtendTrialDto, ManualPaymentDto, ReasonDto, SubscriptionsQueryDto, UpdatePlanDto } from './dto.js';
import { AdminArea, SuperadminOnly } from './global-roles.guard.js';

@ApiTags('admin')
@AdminArea()
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('admin')
export class AdminBillingController {
  constructor(
    private readonly plans: AdminPlansService,
    private readonly subscriptions: AdminSubscriptionsService,
    private readonly payments: PaymentReviewService,
    private readonly settings: PlatformSettingsService,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'Planes con su versión vigente y cantidad de suscripciones' })
  listPlans() {
    return this.plans.list();
  }

  @Get('plans/:id/versions')
  planVersions(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.plans.versions(id);
  }

  @Patch('plans/:id')
  @SuperadminOnly()
  @ApiOperation({ summary: 'Editar plan; si cambian condiciones comerciales se crea una nueva versión (no afecta periodos ya contratados)' })
  updatePlan(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdatePlanDto, @CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.plans.update(id, dto, a.userId, clientIp(req));
  }

  @Get('subscriptions')
  listSubscriptions(@Query() q: SubscriptionsQueryDto) {
    return this.subscriptions.list(q);
  }

  @Get('subscriptions/:id')
  subscription(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.subscriptions.detail(id);
  }

  @Post('subscriptions/:id/renew')
  @SuperadminOnly()
  @ApiOperation({ summary: 'Registrar un pago manual del plan actual y renovar desde el vencimiento vigente' })
  renew(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ManualPaymentDto, @CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.subscriptions.manualPayment(id, dto, a.userId, clientIp(req));
  }

  @Post('subscriptions/:id/change-plan')
  @SuperadminOnly()
  @ApiOperation({ summary: 'Activar o cambiar de plan registrando el pago manual correspondiente' })
  changePlan(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ChangePlanDto, @CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.subscriptions.manualPayment(id, dto, a.userId, clientIp(req));
  }

  @Post('subscriptions/:id/extend-trial')
  @SuperadminOnly()
  @HttpCode(HttpStatus.OK)
  extendTrial(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ExtendTrialDto, @CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.subscriptions.transition(id, 'EXTEND_TRIAL', a.userId, dto.reason, clientIp(req), dto.days);
  }

  @Post('subscriptions/:id/:action')
  @SuperadminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'suspend | reactivate | cancel (con motivo)' })
  transition(@Param('id', new ParseUUIDPipe()) id: string, @Param('action') action: string, @Body() dto: ReasonDto, @CurrentAuth() a: AuthContext, @Req() req: Request) {
    const map = { suspend: 'SUSPEND', reactivate: 'REACTIVATE', cancel: 'CANCEL' } as const;
    const key = map[action as keyof typeof map];
    if (!key) throw new AppError(HttpStatus.NOT_FOUND, 'INVALID_TRANSITION', 'Acción no válida.');
    return this.subscriptions.transition(id, key, a.userId, dto.reason, clientIp(req));
  }

  @Get('payments')
  @ApiOperation({ summary: 'Solicitudes de pago (los pendientes con comprobante primero)' })
  listPayments(@Query() q: ListPaymentsQueryDto) {
    return this.payments.list(q);
  }

  @Get('payments/:id')
  payment(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.payments.get(id);
  }

  @Post('payments/:id/approve')
  @SuperadminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprobar (transaccional e idempotente: una solicitud solo puede aprobarse una vez)' })
  approve(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ApprovePaymentDto, @CurrentAuth() a: AuthContext, @Req() req: Request) {
    if (!dto.amountVerified) throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Confirma que verificaste el importe recibido.', { errors: { amountVerified: ['Confirma que verificaste el importe recibido.'] } });
    return this.payments.approve(id, a.userId, dto.note ?? null, clientIp(req));
  }

  @Post('payments/:id/reject')
  @SuperadminOnly()
  @HttpCode(HttpStatus.OK)
  reject(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: RejectPaymentDto, @CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.payments.reject(id, a.userId, dto.reason, clientIp(req));
  }

  @Get('settings')
  getSettings() {
    return this.settings.view();
  }

  @Patch('settings')
  @SuperadminOnly()
  @ApiOperation({ summary: 'Configuración general, suscripciones, pagos y notificaciones (sin secretos de infraestructura)' })
  updateSettings(@Body() dto: UpdatePlatformSettingsDto, @CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.settings.update(dto, a.userId, clientIp(req));
  }

  @Post('settings/payment-qr')
  @SuperadminOnly()
  @UseInterceptors(imageUpload)
  @ApiConsumes('multipart/form-data')
  uploadQr(@UploadedFile() file: Express.Multer.File | undefined, @CurrentAuth() a: AuthContext, @Req() req: Request) {
    if (!file) throw new AppError(HttpStatus.BAD_REQUEST, 'INVALID_IMAGE', 'Selecciona la imagen del QR bancario.');
    return this.settings.uploadQr(file.buffer, a.userId, clientIp(req));
  }
}
