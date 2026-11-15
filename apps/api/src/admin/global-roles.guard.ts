import { applyDecorators, type CanActivate, type ExecutionContext, HttpStatus, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiCookieAuth, ApiForbiddenResponse } from '@nestjs/swagger';
import { SESSION_COOKIE } from '../auth/session.service.js';
import { AppError } from '../common/app-error.js';
import type { AppRequest } from '../common/request-context.js';
import type { GlobalRole } from '../generated/prisma/enums.js';

const GLOBAL_ROLES_KEY = 'admin:globalRoles';

@Injectable()
export class GlobalRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AppRequest>();
    const allowed = this.reflector.getAllAndOverride<GlobalRole[] | undefined>(GLOBAL_ROLES_KEY, [context.getHandler(), context.getClass()]) ?? ['SUPERADMIN'];
    const role = req.auth?.globalRole ?? null;
    if (!role || !allowed.includes(role)) {
      throw new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN_GLOBAL_ROLE', 'No tienes permisos de administración de ModaFlow.');
    }
    return true;
  }
}

export const AdminArea = (...roles: GlobalRole[]) =>
  applyDecorators(
    SetMetadata(GLOBAL_ROLES_KEY, roles.length ? roles : ['SUPERADMIN', 'SUPPORT']),
    UseGuards(GlobalRolesGuard),
    ApiCookieAuth(SESSION_COOKIE),
    ApiForbiddenResponse({ description: 'Sin rol global (FORBIDDEN_GLOBAL_ROLE)' }),
  );

export const SuperadminOnly = () => SetMetadata(GLOBAL_ROLES_KEY, ['SUPERADMIN']);
