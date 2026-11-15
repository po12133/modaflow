import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EntitlementsService } from './entitlements.service.js';

const REQUEST_SELECT = {
  id: true,
  status: true,
  note: true,
  createdAt: true,
  fromPlan: { select: { name: true } },
  toPlan: { select: { name: true } },
} as const;

type RequestRow = Prisma.PlanChangeRequestGetPayload<{ select: typeof REQUEST_SELECT }>;

/**
 * Plan change requests. Tenants can only *request* a change; activating a
 * paid plan (and charging for it) is reserved for a future staff/billing flow.
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async listRequests(tenantId: string) {
    const rows = await this.prisma.planChangeRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: REQUEST_SELECT,
    });
    return rows.map(toDto);
  }

  async createRequest(tenantId: string, userId: string, planCode: string, note: string | null) {
    const target = await this.prisma.plan.findUnique({ where: { code: planCode } });
    if (!target || !target.isActive) {
      throw new AppError(HttpStatus.NOT_FOUND, 'PLAN_NOT_FOUND', 'El plan solicitado no existe.');
    }
    const current = await this.entitlements.getForTenant(tenantId);
    // The trial can't be requested; the current plan only makes sense to renew once expired.
    if (target.isTrial || (target.id === current.plan.id && current.isOperational)) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'PLAN_NOT_REQUESTABLE', 'Elige un plan de pago distinto al actual.');
    }
    try {
      const row = await this.prisma.planChangeRequest.create({
        data: { tenantId, requestedById: userId, fromPlanId: current.plan.id, toPlanId: target.id, note },
        select: REQUEST_SELECT,
      });
      return toDto(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          HttpStatus.CONFLICT,
          'PENDING_REQUEST_EXISTS',
          'Ya tienes una solicitud pendiente. Cancélala para pedir otro plan.',
        );
      }
      throw error;
    }
  }

  async cancelRequest(tenantId: string, id: string): Promise<void> {
    // tenantId in the filter: another tenant's request id behaves as not found.
    const result = await this.prisma.planChangeRequest.updateMany({
      where: { id, tenantId, status: 'PENDING' },
      data: { status: 'CANCELED' },
    });
    if (result.count === 0) {
      throw new AppError(HttpStatus.NOT_FOUND, 'REQUEST_NOT_FOUND', 'No se encontró una solicitud pendiente.');
    }
  }
}

function toDto(row: RequestRow) {
  return {
    id: row.id,
    status: row.status,
    fromPlan: row.fromPlan.name,
    toPlan: row.toPlan.name,
    note: row.note,
    createdAt: row.createdAt,
  };
}
