import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { generateToken, sha256 } from '../common/crypto.js';
import { DAY_MS } from '../subscriptions/entitlement-rules.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { GlobalRole } from '../generated/prisma/enums.js';

export const SESSION_COOKIE = 'mf_session';
/** Avoid a DB write on every request: refresh last_used_at at most this often. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface SessionMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface ValidSession {
  id: string;
  userId: string;
  activeTenantId: string | null;
  globalRole: GlobalRole | null;
}

@Injectable()
export class SessionService {
  private readonly ttlMs: number;
  private readonly secureCookie: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.ttlMs = config.get('SESSION_TTL_DAYS', { infer: true }) * DAY_MS;
    this.secureCookie =
      config.get('COOKIE_SECURE', { infer: true }) ?? config.get('NODE_ENV', { infer: true }) === 'production';
  }

  async create(
    userId: string,
    meta: SessionMeta,
    activeTenantId: string | null = null,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: sha256(token),
        activeTenantId,
        expiresAt,
        ipAddress: meta.ipAddress?.slice(0, 64),
        userAgent: meta.userAgent?.slice(0, 512),
      },
    });
    return { token, expiresAt };
  }

  async validate(token: string): Promise<ValidSession | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(token) },
      select: { id: true, userId: true, activeTenantId: true, expiresAt: true, lastUsedAt: true, user: { select: { status: true, globalRole: true } } },
    });
    const now = Date.now();
    if (!session) return null;
    if (session.expiresAt.getTime() <= now || session.user.status === 'SUSPENDED') {
      await this.prisma.session.deleteMany({ where: { id: session.id } });
      return null;
    }
    if (now - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date(now) } });
    }
    return { id: session.id, userId: session.userId, activeTenantId: session.activeTenantId, globalRole: session.user.globalRole };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    });
  }

  async setActiveTenant(sessionId: string, tenantId: string): Promise<void> {
    await this.prisma.session.update({ where: { id: sessionId }, data: { activeTenantId: tenantId } });
  }

  setCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(SESSION_COOKIE, token, { ...this.cookieOptions(), expires: expiresAt });
  }

  clearCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.secureCookie, sameSite: 'lax', path: '/' };
  }
}
