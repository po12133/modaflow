import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '../common/app-error.js';
import type { AppRequest } from '../common/request-context.js';
import type { MembershipRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const TENANT_ROLES_KEY = 'tenancy:roles';

/**
 * Resolves the tenant for the request from the authenticated user's
 * memberships. The tenant is NEVER taken from the request body, query or
 * params: the session's active tenant is used if the user still belongs to
 * it, otherwise the user's oldest membership. Optionally enforces roles.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    if (!req.auth) {
      throw new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
    }

    const { userId, activeTenantId } = req.auth;
    const membership =
      (activeTenantId &&
        (await this.prisma.tenantMembership.findUnique({
          where: { tenantId_userId: { tenantId: activeTenantId, userId } },
          select: { tenantId: true, role: true },
        }))) ||
      (await this.prisma.tenantMembership.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { tenantId: true, role: true },
      }));

    if (!membership) {
      throw new AppError(HttpStatus.FORBIDDEN, 'NO_TENANT', 'Primero crea tu tienda.');
    }

    const roles = this.reflector.getAllAndOverride<MembershipRole[] | undefined>(TENANT_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length && !roles.includes(membership.role)) {
      throw new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN_ROLE', 'Tu rol no permite realizar esta acción.');
    }

    req.tenant = { tenantId: membership.tenantId, role: membership.role };
    return true;
  }
}
