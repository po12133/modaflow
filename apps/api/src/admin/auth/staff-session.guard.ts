import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../auth/decorators.js';
import { AppError } from '../../common/app-error.js';
import type { AdminRequest } from './staff-context.js';
import { ADMIN_SESSION_COOKIE, StaffSessionService } from './staff-session.service.js';

@Injectable()
export class StaffSessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: StaffSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    const token: unknown = req.cookies?.[ADMIN_SESSION_COOKIE];
    const session = typeof token === 'string' && token.length > 0 ? await this.sessions.validate(token) : null;
    if (session) req.staff = { staffId: session.staffId, sessionId: session.id, role: session.role };
    if (isPublic || session) return true;
    throw new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
  }
}
