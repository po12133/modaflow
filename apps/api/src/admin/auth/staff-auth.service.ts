import { HttpStatus, Injectable } from '@nestjs/common';
import { LOCKOUT_MINUTES, MAX_FAILED_LOGINS } from '../../auth/auth.service.js';
import { PasswordService } from '../../auth/password.service.js';
import { AppError } from '../../common/app-error.js';
import { sha256 } from '../../common/crypto.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { ChangePasswordDto, SetupPasswordDto, StaffLoginDto } from './dto.js';
import { type StaffSessionMeta, StaffSessionService } from './staff-session.service.js';

const STAFF_PUBLIC = { id: true, name: true, email: true, role: true, lastLoginAt: true } as const;

@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: StaffSessionService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: StaffLoginDto, meta: StaffSessionMeta) {
    const staff = await this.prisma.staff.findUnique({ where: { email: dto.email } });
    if (!staff?.passwordHash || staff.status !== 'ACTIVE') {
      await this.passwords.verifyDummy(dto.password);
      throw this.invalidCredentials();
    }
    const now = new Date();
    if (staff.lockedUntil && staff.lockedUntil > now) {
      const minutes = Math.ceil((staff.lockedUntil.getTime() - now.getTime()) / 60_000);
      throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'ACCOUNT_LOCKED', `Demasiados intentos fallidos. Intenta de nuevo en ${minutes} min.`, { retryAfterMinutes: minutes });
    }
    if (!(await this.passwords.verify(staff.passwordHash, dto.password))) {
      const lock = staff.failedLoginAttempts + 1 >= MAX_FAILED_LOGINS;
      await this.prisma.staff.update({
        where: { id: staff.id },
        data: lock ? { failedLoginAttempts: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) } : { failedLoginAttempts: staff.failedLoginAttempts + 1 },
      });
      if (lock) await this.audit.record({ actorId: staff.id, action: 'STAFF_LOCKED', entityType: 'Staff', entityId: staff.id, result: 'FAILURE', ip: meta.ipAddress ?? null });
      throw this.invalidCredentials();
    }
    await this.prisma.staff.update({ where: { id: staff.id }, data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now } });
    const session = await this.sessions.create(staff.id, meta);
    await this.audit.record({ actorId: staff.id, action: 'STAFF_LOGIN', entityType: 'Staff', entityId: staff.id, ip: meta.ipAddress ?? null });
    return { staff: await this.me(staff.id), session };
  }

  me(staffId: string) {
    return this.prisma.staff.findUniqueOrThrow({ where: { id: staffId }, select: STAFF_PUBLIC });
  }

  async setupPassword(dto: SetupPasswordDto, ip: string | null): Promise<void> {
    const passwordHash = await this.passwords.hash(dto.password);
    await this.prisma.$transaction(async (tx) => {
      const token = await tx.staffSetupToken.findUnique({ where: { tokenHash: sha256(dto.token) }, include: { staff: { select: { status: true } } } });
      if (!token || token.usedAt || token.expiresAt <= new Date() || token.staff.status !== 'ACTIVE') {
        throw new AppError(HttpStatus.BAD_REQUEST, 'INVALID_SETUP_TOKEN', 'El enlace no es válido o ya venció. Pide uno nuevo al administrador del servidor.');
      }
      await tx.staffSetupToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
      await tx.staffSetupToken.deleteMany({ where: { staffId: token.staffId, usedAt: null } });
      await tx.staff.update({ where: { id: token.staffId }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } });
      await tx.staffSession.deleteMany({ where: { staffId: token.staffId } });
      await this.audit.record({ actorId: token.staffId, action: 'STAFF_PASSWORD_SET', entityType: 'Staff', entityId: token.staffId, ip }, tx);
    });
  }

  async changePassword(staffId: string, sessionId: string, dto: ChangePasswordDto, ip: string | null): Promise<void> {
    const staff = await this.prisma.staff.findUniqueOrThrow({ where: { id: staffId }, select: { passwordHash: true } });
    if (!staff.passwordHash || !(await this.passwords.verify(staff.passwordHash, dto.currentPassword))) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'INVALID_PASSWORD', 'La contraseña actual no es correcta.', { errors: { currentPassword: ['La contraseña actual no es correcta.'] } });
    }
    await this.prisma.staff.update({ where: { id: staffId }, data: { passwordHash: await this.passwords.hash(dto.newPassword) } });
    await this.sessions.revokeAll(staffId, sessionId);
    await this.audit.record({ actorId: staffId, action: 'STAFF_PASSWORD_CHANGED', entityType: 'Staff', entityId: staffId, ip });
  }

  private invalidCredentials() {
    return new AppError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
  }
}
