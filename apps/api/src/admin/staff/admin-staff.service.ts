import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from '../../common/app-error.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AdminEnvironmentVariables } from '../admin-env.js';
import { AuditService } from '../audit/audit.service.js';
import type { InviteStaffDto, UpdateStaffDto } from './dto.js';
import { issueSetupLink } from './setup-links.js';

const STAFF_SELECT = { id: true, name: true, email: true, role: true, status: true, passwordHash: true, lastLoginAt: true, lockedUntil: true, createdAt: true, _count: { select: { sessions: true } } } as const;

type Row = Prisma.StaffGetPayload<{ select: typeof STAFF_SELECT }>;

function view({ passwordHash, _count, ...s }: Row) {
  return { ...s, hasPassword: passwordHash !== null, activeSessions: _count.sessions };
}

@Injectable()
export class AdminStaffService {
  private readonly adminWebUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService<AdminEnvironmentVariables, true>,
  ) {
    this.adminWebUrl = config.get('ADMIN_WEB_URL', { infer: true });
  }

  async list() {
    const rows = await this.prisma.staff.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'asc' }], select: STAFF_SELECT });
    return rows.map(view);
  }

  async invite(dto: InviteStaffDto, actorId: string, ip: string | null) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const staff = await tx.staff.create({ data: { name: dto.name, email: dto.email, role: dto.role }, select: STAFF_SELECT });
        const link = await issueSetupLink(tx, staff.id, this.adminWebUrl);
        await this.audit.record({ actorId, action: 'STAFF_INVITED', entityType: 'Staff', entityId: staff.id, after: { email: dto.email, role: dto.role }, ip }, tx);
        return { staff: view(staff), setupUrl: link.url, expiresAt: link.expiresAt };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'Ese correo ya pertenece al equipo.', { errors: { email: ['Ese correo ya pertenece al equipo.'] } });
      }
      throw error;
    }
  }

  async setupLink(id: string, actorId: string, ip: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.findUnique({ where: { id }, select: { status: true } });
      if (!staff) throw this.notFound();
      if (staff.status !== 'ACTIVE') throw new AppError(HttpStatus.CONFLICT, 'STAFF_DISABLED', 'Reactiva el acceso antes de generar un enlace.');
      const link = await issueSetupLink(tx, id, this.adminWebUrl);
      await this.audit.record({ actorId, action: 'STAFF_SETUP_LINK', entityType: 'Staff', entityId: id, ip }, tx);
      return { setupUrl: link.url, expiresAt: link.expiresAt };
    });
  }

  async update(id: string, dto: UpdateStaffDto, actorId: string, ip: string | null) {
    if (!dto.role && !dto.status) throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Indica el rol o el estado.');
    if (id === actorId) throw new AppError(HttpStatus.CONFLICT, 'STAFF_SELF_CHANGE', 'No puedes cambiar tu propio rol ni desactivar tu propio acceso.');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM admin.staff WHERE role = 'SUPERADMIN' AND status = 'ACTIVE' FOR UPDATE`;
      const before = await tx.staff.findUnique({ where: { id }, select: { role: true, status: true } });
      if (!before) throw this.notFound();
      const after = { role: dto.role ?? before.role, status: dto.status ?? before.status };
      const losesSuperadmin = before.role === 'SUPERADMIN' && before.status === 'ACTIVE' && (after.role !== 'SUPERADMIN' || after.status !== 'ACTIVE');
      if (losesSuperadmin && (await tx.staff.count({ where: { role: 'SUPERADMIN', status: 'ACTIVE', id: { not: id } } })) === 0) {
        throw new AppError(HttpStatus.CONFLICT, 'LAST_SUPERADMIN', 'Debe quedar al menos un superadministrador activo.');
      }
      await tx.staff.update({ where: { id }, data: after });
      if (after.status === 'DISABLED' || after.role !== before.role) await tx.staffSession.deleteMany({ where: { staffId: id } });
      const action = after.role !== before.role ? 'STAFF_ROLE_CHANGED' : after.status === 'DISABLED' ? 'STAFF_DISABLED' : 'STAFF_ENABLED';
      await this.audit.record({ actorId, action, entityType: 'Staff', entityId: id, before, after, reason: dto.reason, ip }, tx);
    });
    return (await this.list()).find((s) => s.id === id);
  }

  private notFound() {
    return new AppError(HttpStatus.NOT_FOUND, 'STAFF_NOT_FOUND', 'No se encontró al miembro del equipo.');
  }
}
