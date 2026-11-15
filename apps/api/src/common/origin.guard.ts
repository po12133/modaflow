import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { EnvironmentVariables } from '../config/env.validation.js';
import { AppError } from './app-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated, state-changing requests.
 *
 * Browsers always attach `Origin` to cross-site and same-site POST/PUT/PATCH/
 * DELETE requests, so a request whose Origin is not explicitly allowed is
 * rejected (this also blocks sibling subdomains, which SameSite=Lax would
 * treat as same-site). Requests without Origin come from non-browser clients
 * (e.g. the Next.js server calling this API internally) and cannot carry a
 * victim's cookies, so they are allowed.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowAny: boolean;
  private readonly allowed: Set<string>;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const origins = config.get('CORS_ORIGINS', { infer: true }).trim();
    this.allowAny = origins === '*';
    this.allowed = new Set(
      origins
        .split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const origin = req.headers.origin;
    if (origin === undefined) return true;
    if (this.allowAny && origin !== 'null') return true;
    if (this.allowed.has(origin)) return true;
    // Same-origin calls, e.g. Swagger UI served by this API.
    if (origin === `${req.protocol}://${req.get('host')}`) return true;

    throw new AppError(HttpStatus.FORBIDDEN, 'INVALID_ORIGIN', 'Origen de la solicitud no permitido.');
  }
}
