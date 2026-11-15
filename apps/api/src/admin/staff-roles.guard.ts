import { applyDecorators, type CanActivate, type ExecutionContext, HttpStatus, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiCookieAuth, ApiForbiddenResponse } from '@nestjs/swagger';
import { AppError } from '../common/app-error.js';
import type { StaffRole } from '../generated/prisma/enums.js';
import type { AdminRequest } from './auth/staff-context.js';
import { ADMIN_SESSION_COOKIE } from './auth/staff-session.service.js';

const STAFF_ROLES_KEY = 'admin:staffRoles';

@Injectable()
export class StaffRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const allowed = this.reflector.getAllAndOverride<StaffRole[] | undefined>(STAFF_ROLES_KEY, [context.getHandler(), context.getClass()]) ?? ['SUPERADMIN'];
    const role = req.staff?.role;
    if (!role || !allowed.includes(role)) {
      throw new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN_STAFF_ROLE', 'Tu rol no permite esta acción.');
    }
    return true;
  }
}

export const AdminArea = (...roles: StaffRole[]) =>
  applyDecorators(
    SetMetadata(STAFF_ROLES_KEY, roles.length ? roles : ['SUPERADMIN', 'SUPPORT']),
    UseGuards(StaffRolesGuard),
    ApiCookieAuth(ADMIN_SESSION_COOKIE),
    ApiForbiddenResponse({ description: 'Rol insuficiente (FORBIDDEN_STAFF_ROLE)' }),
  );

export const SuperadminOnly = () => SetMetadata(STAFF_ROLES_KEY, ['SUPERADMIN']);
