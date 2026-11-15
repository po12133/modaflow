import { applyDecorators, createParamDecorator, type ExecutionContext, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { AppRequest, TenantContext } from '../common/request-context.js';
import type { MembershipRole } from '../generated/prisma/enums.js';
import { SESSION_COOKIE } from '../auth/session.service.js';
import { TENANT_ROLES_KEY, TenantGuard } from './tenant.guard.js';

/**
 * Requires an authenticated member of a tenant. Pass roles to restrict
 * further, e.g. `@TenantScoped('OWNER', 'ADMIN')`.
 */
export const TenantScoped = (...roles: MembershipRole[]) =>
  applyDecorators(
    SetMetadata(TENANT_ROLES_KEY, roles),
    UseGuards(TenantGuard),
    ApiCookieAuth(SESSION_COOKIE),
    ApiUnauthorizedResponse({ description: 'Sin sesión (UNAUTHENTICATED)' }),
    ApiForbiddenResponse({ description: 'Sin tienda (NO_TENANT) o rol insuficiente (FORBIDDEN_ROLE)' }),
  );

/** Restricts a single handler of a @TenantScoped() controller to some roles. */
export const TenantRoles = (...roles: MembershipRole[]) => SetMetadata(TENANT_ROLES_KEY, roles);

/** Tenant resolved by TenantGuard for the current user. */
export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): TenantContext => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.tenant) throw new Error('CurrentTenant used on a route without @TenantScoped()');
  return req.tenant;
});
