import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '../common/app-error.js';
import type { AppRequest } from '../common/request-context.js';
import { IS_PUBLIC_KEY } from './decorators.js';
import { SESSION_COOKIE, SessionService } from './session.service.js';

/**
 * Global guard: every route requires a valid session cookie unless marked
 * with @Public(). Public routes still get `req.auth` when a session exists.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const session = typeof token === 'string' && token.length > 0 ? await this.sessions.validate(token) : null;
    if (session) {
      req.auth = { userId: session.userId, sessionId: session.id, activeTenantId: session.activeTenantId };
    }

    if (isPublic || session) return true;
    throw new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
  }
}
