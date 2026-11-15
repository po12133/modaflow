import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AppError } from '../../common/app-error.js';
import { clientIp } from '../../common/client-ip.js';
import { INTEGRATION_SECTIONS, type IntegrationSection } from '../../integrations/integration-config.js';
import { CurrentStaff, type StaffContext } from '../auth/staff-context.js';
import { AdminArea, SuperadminOnly } from '../staff-roles.guard.js';
import { AdminIntegrationsService } from './admin-integrations.service.js';
import { AiIntegrationDto, EmailIntegrationDto, ReauthDto, StorageIntegrationDto } from './dto.js';

const SENSITIVE = { default: { limit: 10, ttl: 60_000 } };

function sectionOf(value: string): IntegrationSection {
  if (!INTEGRATION_SECTIONS.includes(value as IntegrationSection)) throw new AppError(HttpStatus.NOT_FOUND, 'INTEGRATION_NOT_FOUND', 'Integración desconocida.');
  return value as IntegrationSection;
}

@ApiTags('admin integrations')
@AdminArea()
@Controller('admin/integrations')
export class AdminIntegrationsController {
  constructor(private readonly integrations: AdminIntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'Estado de S3, Claude y correo: valores no secretos, origen (panel o variable de entorno) y si cada llave está configurada. Nunca devuelve llaves.' })
  view() {
    return this.integrations.view();
  }

  @Patch('storage')
  @SuperadminOnly()
  @Throttle(SENSITIVE)
  storage(@Body() dto: StorageIntegrationDto, @CurrentStaff() me: StaffContext, @Req() req: Request) {
    return this.integrations.update('storage', dto, me.staffId, clientIp(req));
  }

  @Patch('ai')
  @SuperadminOnly()
  @Throttle(SENSITIVE)
  ai(@Body() dto: AiIntegrationDto, @CurrentStaff() me: StaffContext, @Req() req: Request) {
    return this.integrations.update('ai', dto, me.staffId, clientIp(req));
  }

  @Patch('email')
  @SuperadminOnly()
  @Throttle(SENSITIVE)
  email(@Body() dto: EmailIntegrationDto, @CurrentStaff() me: StaffContext, @Req() req: Request) {
    return this.integrations.update('email', dto, me.staffId, clientIp(req));
  }

  @Post('storage/test')
  @SuperadminOnly()
  @Throttle(SENSITIVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Probar sin guardar: sube y borra un archivo en el bucket' })
  testStorage(@Body() dto: StorageIntegrationDto, @CurrentStaff() me: StaffContext, @Req() req: Request) {
    return this.integrations.test('storage', dto, me.staffId, clientIp(req));
  }

  @Post('ai/test')
  @SuperadminOnly()
  @Throttle(SENSITIVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Probar sin guardar: valida la llave y el modelo de Claude (sin consumir tokens)' })
  testAi(@Body() dto: AiIntegrationDto, @CurrentStaff() me: StaffContext, @Req() req: Request) {
    return this.integrations.test('ai', dto, me.staffId, clientIp(req));
  }

  @Post('email/test')
  @SuperadminOnly()
  @Throttle(SENSITIVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Probar sin guardar: conecta al SMTP y envía un correo de prueba a tu correo del equipo' })
  testEmail(@Body() dto: EmailIntegrationDto, @CurrentStaff() me: StaffContext, @Req() req: Request) {
    return this.integrations.test('email', dto, me.staffId, clientIp(req));
  }

  @Post(':section/reset')
  @SuperadminOnly()
  @Throttle(SENSITIVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quitar del panel todos los valores de la sección y volver a las variables de entorno' })
  reset(@Param('section') section: string, @Body() dto: ReauthDto, @CurrentStaff() me: StaffContext, @Req() req: Request) {
    return this.integrations.reset(sectionOf(section), dto.currentPassword, me.staffId, clientIp(req));
  }
}
