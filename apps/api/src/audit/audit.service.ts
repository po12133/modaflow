import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Db = Prisma.TransactionClient | PrismaService;

const SENSITIVE = /pass|hash|token|secret|key|cookie|session/i;

export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  result?: 'SUCCESS' | 'FAILURE';
  ip?: string | null;
}

export function sanitize(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!value) return Prisma.DbNull;
  const clean = Object.fromEntries(
    Object.entries(value)
      .filter(([k]) => !SENSITIVE.test(k))
      .map(([k, v]) => [k, v instanceof Date ? v.toISOString() : typeof v === 'bigint' ? v.toString() : v]),
  );
  return JSON.parse(JSON.stringify(clean)) as Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry, db: Db = this.prisma) {
    return db.adminAuditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: sanitize(entry.before),
        after: sanitize(entry.after),
        reason: entry.reason ?? null,
        result: entry.result ?? 'SUCCESS',
        ip: entry.ip ?? null,
      },
    });
  }

  async list(q: { entityType?: string; entityId?: string; actorId?: string; action?: string; page?: number; pageSize?: number }) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 30;
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.action ? { action: q.action } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }
}
