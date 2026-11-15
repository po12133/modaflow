import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AppRequest, AuthContext } from '../common/request-context.js';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/** Marks a route as accessible without a session. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Authenticated user/session (populated by SessionGuard). */
export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.auth) throw new Error('CurrentAuth used on a route without SessionGuard');
  return req.auth;
});
