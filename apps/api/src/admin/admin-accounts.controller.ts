import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentStaff, type StaffContext } from './auth/staff-context.js';
import { clientIp } from '../common/client-ip.js';
import { AdminTenantsService } from './admin-tenants.service.js';
import { AdminUsersService } from './admin-users.service.js';
import { TenantStatusDto, TenantsQueryDto, UserStatusDto, UsersQueryDto } from './dto.js';
import { AdminArea, SuperadminOnly } from './staff-roles.guard.js';

@ApiTags('admin')
@AdminArea()
@Controller('admin')
export class AdminAccountsController {
  constructor(
    private readonly tenants: AdminTenantsService,
    private readonly users: AdminUsersService,
  ) {}

  @Get('tenants')
  @ApiOperation({ summary: 'Negocios registrados (búsqueda por nombre, correo, WhatsApp o ID; filtros por plan, estado y fechas)' })
  listTenants(@Query() q: TenantsQueryDto) {
    return this.tenants.list(q);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Detalle del negocio: usuarios, tiendas, suscripción, pagos e historial' })
  tenant(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tenants.detail(id);
  }

  @Patch('tenants/:id/status')
  @SuperadminOnly()
  @ApiOperation({ summary: 'Suspender o reactivar un negocio (con motivo y auditoría)' })
  tenantStatus(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: TenantStatusDto, @CurrentStaff() auth: StaffContext, @Req() req: Request) {
    return this.tenants.setStatus(id, dto, auth.staffId, clientIp(req));
  }

  @Get('users')
  @ApiOperation({ summary: 'Usuarios (sin contraseñas ni hashes)' })
  listUsers(@Query() q: UsersQueryDto) {
    return this.users.list(q);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Detalle de usuario y negocios asociados' })
  user(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.detail(id);
  }

  @Patch('users/:id/status')
  @SuperadminOnly()
  @ApiOperation({ summary: 'Suspender o reactivar el acceso de un usuario (cierra sus sesiones)' })
  userStatus(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UserStatusDto, @CurrentStaff() auth: StaffContext, @Req() req: Request) {
    return this.users.setStatus(id, dto, auth.staffId, clientIp(req));
  }
}
