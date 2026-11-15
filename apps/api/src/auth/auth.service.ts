import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from '../common/app-error.js';
import { generateToken, sha256 } from '../common/crypto.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { Prisma } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto, MeDto, RegisterDto, UserDto } from './dto.js';
import { PasswordService } from './password.service.js';
import { type SessionMeta, SessionService } from './session.service.js';

/** Consecutive failures before the account is temporarily locked. */
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
const RESET_TOKEN_TTL_MINUTES = 60;

const USER_SELECT = { id: true, name: true, email: true, createdAt: true, globalRole: true } as const;

@Injectable()
export class AuthService {
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.webAppUrl = config.get('WEB_APP_URL', { infer: true });
  }

  async register(dto: RegisterDto, meta: SessionMeta) {
    const passwordHash = await this.passwords.hash(dto.password);
    let user: UserDto;
    try {
      user = await this.prisma.user.create({
        data: { name: dto.name, email: dto.email, passwordHash },
        select: USER_SELECT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'Ya existe una cuenta con ese correo.');
      }
      throw error;
    }
    const session = await this.sessions.create(user.id, meta);
    return { user, session };
  }

  async login(dto: LoginDto, meta: SessionMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      await this.passwords.verifyDummy(dto.password);
      throw this.invalidCredentials();
    }

    const now = new Date();
    if (user.status === 'SUSPENDED') {
      await this.passwords.verifyDummy(dto.password);
      throw new AppError(HttpStatus.FORBIDDEN, 'ACCOUNT_SUSPENDED', 'Tu acceso está suspendido. Escribe a soporte de ModaFlow.');
    }
    if (user.lockedUntil && user.lockedUntil > now) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000);
      throw new AppError(
        HttpStatus.TOO_MANY_REQUESTS,
        'ACCOUNT_LOCKED',
        `Demasiados intentos fallidos. Intenta de nuevo en ${minutes} min o recupera tu contraseña.`,
        { retryAfterMinutes: minutes },
      );
    }

    if (!(await this.passwords.verify(user.passwordHash, dto.password))) {
      const attempts = user.failedLoginAttempts + 1;
      const lock = attempts >= MAX_FAILED_LOGINS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: lock
          ? { failedLoginAttempts: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) }
          : { failedLoginAttempts: attempts },
      });
      throw this.invalidCredentials();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now },
    });
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { tenantId: true },
    });
    const session = await this.sessions.create(user.id, meta, membership?.tenantId ?? null);
    return { user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }, session };
  }

  async me(userId: string, activeTenantId: string | null): Promise<MeDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: USER_SELECT });
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { tenantId: true, role: true, tenant: { select: { name: true } } },
    });
    const active = memberships.find((m) => m.tenantId === activeTenantId) ?? memberships[0];
    return {
      user,
      membership: active ? { tenantId: active.tenantId, tenantName: active.tenant.name, role: active.role } : null,
      needsOnboarding: memberships.length === 0,
    };
  }

  /** Always resolves the same way whether or not the email exists (no account enumeration). */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
    if (!user) return;

    const token = generateToken();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
        },
      }),
    ]);
    const url = `${this.webAppUrl}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
    await this.mail.sendPasswordReset({ userId: user.id, email: user.email, name: user.name }, url);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'INVALID_RESET_TOKEN',
        'El enlace de recuperación no es válido o ya venció. Solicita uno nuevo.',
      );
    }
    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      // Single-use: only the request that flips usedAt may change the password.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'INVALID_RESET_TOKEN',
          'El enlace de recuperación no es válido o ya venció. Solicita uno nuevo.',
        );
      }
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      });
      // A password reset signs the user out everywhere.
      await tx.session.deleteMany({ where: { userId: record.userId } });
    });
  }

  private invalidCredentials() {
    return new AppError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
  }
}
