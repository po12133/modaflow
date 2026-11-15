import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { clientIp } from '../../common/client-ip.js';
import { CurrentStaff, type StaffContext } from '../auth/staff-context.js';
import { AdminArea, SuperadminOnly } from '../staff-roles.guard.js';
import { AdminStaffService } from './admin-staff.service.js';
import { InviteStaffDto, UpdateStaffDto } from './dto.js';

@ApiTags('admin staff')
@AdminArea()
@Controller('admin/staff')
export class AdminStaffController {
  constructor(private readonly staff: AdminStaffService) {}

  @Get()
  @ApiOperation({ summary: 'Equipo de ModaFlow (sin contraseñas ni hashes)' })
  list() {
    return this.staff.list();
  }

  @Post()
  @SuperadminOnly()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Invitar a un miembro del equipo: devuelve un enlace de un solo uso (24 h) para definir su contraseña' })
  invite(@Body() dto: InviteStaffDto, @CurrentStaff() me: StaffContext, @Req() req: Request) {
    return this.staff.invite(dto, me.staffId, clientIp(req));
  }

  @Post(':id/setup-link')
  @SuperadminOnly()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Nuevo enlace para definir contraseña (invalida el anterior y cierra sus sesiones)' })
  setupLink(@Param('id', new ParseUUIDPipe()) id: string, @CurrentStaff() me: StaffContext, @Req() req: Request) {
    return this.staff.setupLink(id, me.staffId, clientIp(req));
  }

  @Patch(':id')
  @SuperadminOnly()
  @ApiOperation({ summary: 'Cambiar rol o activar/desactivar (con motivo; protege al último superadministrador)' })
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateStaffDto, @CurrentStaff() me: StaffContext, @Req() req: Request) {
    return this.staff.update(id, dto, me.staffId, clientIp(req));
  }
}
