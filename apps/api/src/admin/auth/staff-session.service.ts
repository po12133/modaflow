import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { generateToken, sha256 } from '../../common/crypto.js';
import type { StaffRole } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AdminEnvironmentVariables } from '../admin-env.js';

export const ADMIN_SESSION_COOKIE = 'mf_admin_session';
const TOUCH_INTERVAL_MS = 60_000;

export interface StaffSessionMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface ValidStaffSession {
  id: string;
  staffId: string;
  role: StaffRole;
}

@Injectable()
export class StaffSessionService {
  private readonly ttlMs: number;
  private readonly idleMs: number;
  private readonly secureCookie: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AdminEnvironmentVariables, true>,
  ) {
    this.ttlMs = config.get('ADMIN_SESSION_TTL_HOURS', { infer: true }) * 3_600_000;
    this.idleMs = config.get('ADMIN_SESSION_IDLE_MINUTES', { infer: true }) * 60_000;
    this.secureCookie = config.get('COOKIE_SECURE', { infer: true }) ?? config.get('NODE_ENV', { infer: true }) === 'production';
  }

  async create(staffId: string, meta: StaffSessionMeta): Promise<{ token: string; expiresAt: Date }> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.prisma.staffSession.create({
      data: { staffId, tokenHash: sha256(token), expiresAt, ipAddress: meta.ipAddress?.slice(0, 64), userAgent: meta.userAgent?.slice(0, 512) },
    });
    return { token, expiresAt };
  }

  async validate(token: string): Promise<ValidStaffSession | null> {
    const session = await this.prisma.staffSession.findUnique({
      where: { tokenHash: sha256(token) },
      select: { id: true, staffId: true, expiresAt: true, lastUsedAt: true, staff: { select: { status: true, role: true } } },
    });
    if (!session) return null;
    const now = Date.now();
    if (session.expiresAt.getTime() <= now || now - session.lastUsedAt.getTime() > this.idleMs || session.staff.status !== 'ACTIVE') {
      await this.prisma.staffSession.deleteMany({ where: { id: session.id } });
      return null;
    }
    if (now - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.staffSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date(now) } });
    }
    return { id: session.id, staffId: session.staffId, role: session.staff.role };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.staffSession.deleteMany({ where: { id: sessionId } });
  }

  async revokeAll(staffId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.staffSession.deleteMany({ where: { staffId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
  }

  setCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(ADMIN_SESSION_COOKIE, token, { ...this.cookieOptions(), expires: expiresAt });
  }

  clearCookie(res: Response): void {
    res.clearCookie(ADMIN_SESSION_COOKIE, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.secureCookie, sameSite: 'strict', path: '/' };
  }
}
