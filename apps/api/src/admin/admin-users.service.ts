import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/app-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isUuid } from './admin-status-filter.js';
import type { UserStatusDto, UsersQueryDto } from './dto.js';

const USER_PUBLIC = { id: true, name: true, email: true, status: true, globalRole: true, createdAt: true, lastLoginAt: true, suspendedAt: true, suspendedReason: true } as const;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: UsersQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const search = q.search?.trim();
    const where: Prisma.UserWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search.toLowerCase() } }, ...(isUuid(search) ? [{ id: search }] : [])] }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { ...USER_PUBLIC, memberships: { select: { role: true, tenant: { select: { id: true, name: true } } } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async detail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...USER_PUBLIC, memberships: { orderBy: { createdAt: 'asc' }, select: { role: true, createdAt: true, tenant: { select: { id: true, name: true } } } }, _count: { select: { sessions: true } } },
    });
    if (!user) throw new AppError(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', 'No se encontró el usuario.');
    const { _count, ...rest } = user;
    return { ...rest, activeSessions: _count.sessions };
  }

  async setStatus(id: string, dto: UserStatusDto, actorId: string, ip: string | null) {
    if (id === actorId && dto.status === 'SUSPENDED') {
      throw new AppError(HttpStatus.CONFLICT, 'LAST_SUPERADMIN', 'No puedes suspender tu propio acceso.');
    }
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id }, select: { status: true, globalRole: true } });
      if (!before) throw new AppError(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', 'No se encontró el usuario.');
      if (dto.status === 'SUSPENDED' && before.globalRole === 'SUPERADMIN') {
        await tx.$queryRaw`SELECT id FROM users WHERE global_role = 'SUPERADMIN' FOR UPDATE`;
        const others = await tx.user.count({ where: { globalRole: 'SUPERADMIN', status: 'ACTIVE', id: { not: id } } });
        if (others === 0) throw new AppError(HttpStatus.CONFLICT, 'LAST_SUPERADMIN', 'No se puede suspender al último superadministrador activo.');
      }
      await tx.user.update({
        where: { id },
        data: dto.status === 'SUSPENDED' ? { status: 'SUSPENDED', suspendedAt: new Date(), suspendedReason: dto.reason } : { status: 'ACTIVE', suspendedAt: null, suspendedReason: null },
      });
      if (dto.status === 'SUSPENDED') await tx.session.deleteMany({ where: { userId: id } });
      await this.audit.record({ actorId, action: dto.status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED', entityType: 'User', entityId: id, before: { status: before.status }, after: { status: dto.status }, reason: dto.reason, ip }, tx);
    });
    return this.detail(id);
  }
}
