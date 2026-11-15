import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from './audit/audit.service.js';
import { snapshotPlan, versionChanged, VERSIONED_FIELDS } from '../billing/plan-versions.js';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdatePlanDto } from './dto.js';

@Injectable()
export class AdminPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const [plans, counts] = await Promise.all([
      this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } }),
      this.prisma.subscription.groupBy({ by: ['planId'], _count: true }),
    ]);
    const byPlan = new Map(counts.map((c) => [c.planId, c._count]));
    return plans.map(({ versions, ...p }) => ({ ...p, currentVersion: versions[0]?.version ?? null, subscriptions: byPlan.get(p.id) ?? 0 }));
  }

  async versions(id: string) {
    return this.prisma.planVersion.findMany({ where: { planId: id }, orderBy: { version: 'desc' }, include: { createdBy: { select: { name: true } }, _count: { select: { subscriptions: true } } } });
  }

  async update(id: string, dto: UpdatePlanDto, actorId: string, ip: string | null) {
    const { reason, ...changes } = dto;
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM plans WHERE id = ${id}::uuid FOR UPDATE`;
      if (!rows[0]) throw new AppError(HttpStatus.NOT_FOUND, 'PLAN_NOT_FOUND', 'No se encontró el plan.');
      const before = await tx.plan.findUniqueOrThrow({ where: { id } });
      if (before.isTrial && changes.priceCents !== undefined && changes.priceCents > 0) {
        throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'El plan de prueba no puede tener precio.', { errors: { priceCents: ['El plan de prueba no puede tener precio.'] } });
      }
      const after = await tx.plan.update({ where: { id }, data: changes });
      const newVersion = versionChanged(before, after) ? await snapshotPlan(tx, after, actorId) : null;
      const keys = Object.keys(changes) as (keyof typeof changes)[];
      await this.audit.record(
        {
          actorId,
          action: newVersion ? 'PLAN_VERSIONED' : 'PLAN_UPDATED',
          entityType: 'Plan',
          entityId: id,
          before: Object.fromEntries(keys.map((k) => [k, before[k]])),
          after: { ...Object.fromEntries(keys.map((k) => [k, after[k]])), ...(newVersion ? { version: newVersion.version } : {}) },
          reason,
          ip,
        },
        tx,
      );
      return { ...after, newVersion: newVersion?.version ?? null, versionedFields: VERSIONED_FIELDS };
    });
  }
}
