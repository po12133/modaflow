import { Controller, Delete, Get, HttpStatus, Param, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AppError } from '../common/app-error.js';
import { clientIp } from '../common/client-ip.js';
import { imageUpload } from '../images/image-upload.js';
import { CurrentStaff, type StaffContext } from './auth/staff-context.js';
import { PlanPaymentQrService } from './billing/plan-payment-qr.service.js';
import { PlanCodeParamDto } from './dto.js';
import { AdminArea, SuperadminOnly } from './staff-roles.guard.js';

@ApiTags('admin')
@AdminArea()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('admin/settings/plan-qrs')
export class AdminPaymentQrController {
  constructor(private readonly qrs: PlanPaymentQrService) {}

  @Get()
  @ApiOperation({ summary: 'QR bancario de cada plan de pago (si falta, se usa el QR general)' })
  list() {
    return this.qrs.list();
  }

  @Post(':code')
  @SuperadminOnly()
  @UseInterceptors(imageUpload)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir o reemplazar el QR bancario de un plan' })
  upload(@Param() p: PlanCodeParamDto, @UploadedFile() file: Express.Multer.File | undefined, @CurrentStaff() a: StaffContext, @Req() req: Request) {
    if (!file) throw new AppError(HttpStatus.BAD_REQUEST, 'INVALID_IMAGE', 'Selecciona la imagen del QR bancario.');
    return this.qrs.upload(p.code, file.buffer, a.staffId, clientIp(req));
  }

  @Delete(':code')
  @SuperadminOnly()
  @ApiOperation({ summary: 'Quitar el QR de un plan (vuelve a usarse el QR general)' })
  remove(@Param() p: PlanCodeParamDto, @CurrentStaff() a: StaffContext, @Req() req: Request) {
    return this.qrs.remove(p.code, a.staffId, clientIp(req));
  }
}
