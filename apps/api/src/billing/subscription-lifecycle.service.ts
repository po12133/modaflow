import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import type { PlanChangeRequest, Prisma } from '../generated/prisma/client.js';
import type { SubscriptionStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fromCents } from '../sales/sale-math.js';
import { effectiveStatus } from '../subscriptions/entitlement-rules.js';
import { assertTransition, BillingRuleError, extendedTrialEnd, plannedPeriod, reactivatedStatus, type AdminAction } from './billing-rules.js';

type Tx = Prisma.TransactionClient;

const HISTORY_ACTION = { RENEWAL: 'RENEWED', ACTIVATION: 'ACTIVATED', PLAN_CHANGE: 'PLAN_CHANGED' } as const;

@Injectable()
export class SubscriptionLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async lock(tx: Tx, tenantId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM subscriptions WHERE tenant_id = ${tenantId}::uuid FOR UPDATE`;
    if (!rows[0]) throw new AppError(HttpStatus.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND', 'El negocio no tiene suscripción.');
    return tx.subscription.findUniqueOrThrow({ where: { id: rows[0].id }, include: { plan: true } });
  }

  async applyPayment(tx: Tx, request: PlanChangeRequest, actorId: string, now = new Date()) {
    const sub = await this.lock(tx, request.tenantId);
    const version = await tx.planVersion.findUniqueOrThrow({ where: { id: request.planVersionId! } });
    const planned = this.rule(() =>
      plannedPeriod({ status: sub.status, planId: sub.planId, planIsTrial: sub.plan.isTrial, currentPeriodEnd: sub.currentPeriodEnd }, effectiveStatus(sub, now), request.toPlanId, version, now),
    );
    await tx.subscription.update({
      where: { id: sub.id },
      data: {
        planId: request.toPlanId,
        planVersionId: version.id,
        status: 'ACTIVE',
        currentPeriodEnd: planned.end,
        canceledAt: null,
        ...(planned.kind === 'RENEWAL' ? {} : { startedAt: planned.start }),
      },
    });
    const period = await tx.subscriptionPeriod.create({
      data: {
        subscriptionId: sub.id,
        tenantId: sub.tenantId,
        planId: request.toPlanId,
        planVersionId: version.id,
        kind: planned.kind,
        periodStart: planned.start,
        periodEnd: planned.end,
        amount: fromCents(version.priceCents),
        paymentRequestId: request.id,
        createdById: actorId,
      },
    });
    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        tenantId: sub.tenantId,
        action: HISTORY_ACTION[planned.kind],
        fromStatus: sub.status,
        toStatus: 'ACTIVE',
        fromPlanId: sub.planId,
        toPlanId: request.toPlanId,
        fromPeriodEnd: sub.currentPeriodEnd,
        toPeriodEnd: planned.end,
        reason: request.reviewNote ?? null,
        actorId,
      },
    });
    return { period, previous: { status: sub.status, planId: sub.planId, currentPeriodEnd: sub.currentPeriodEnd } };
  }

  async transition(tenantId: string, action: AdminAction, actorId: string, reason: string, days = 0, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await this.lock(tx, tenantId);
      const effective = effectiveStatus(sub, now);
      this.rule(() => assertTransition(action, effective, sub.plan.isTrial));
      let status: SubscriptionStatus = effective;
      let end = sub.currentPeriodEnd;
      const data: Prisma.SubscriptionUpdateInput = {};
      if (action === 'SUSPEND') {
        status = 'SUSPENDED';
        Object.assign(data, { suspendedAt: now, suspendedFrom: effective });
      } else if (action === 'REACTIVATE') {
        status = reactivatedStatus(sub.suspendedFrom, sub.currentPeriodEnd, now);
        Object.assign(data, { suspendedAt: null, suspendedFrom: null });
      } else if (action === 'CANCEL') {
        status = 'CANCELED';
        Object.assign(data, { canceledAt: now, suspendedAt: null, suspendedFrom: null });
      } else {
        status = 'TRIALING';
        end = extendedTrialEnd(sub.currentPeriodEnd, days, now);
        await tx.subscriptionPeriod.create({
          data: { subscriptionId: sub.id, tenantId, planId: sub.planId, planVersionId: sub.planVersionId, kind: 'EXTENSION', periodStart: new Date(Math.max(sub.currentPeriodEnd.getTime(), now.getTime())), periodEnd: end, amount: 0, createdById: actorId, note: reason.slice(0, 300) },
        });
      }
      const updated = await tx.subscription.update({ where: { id: sub.id }, data: { ...data, status, currentPeriodEnd: end }, include: { plan: true } });
      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: sub.id,
          tenantId,
          action: action === 'SUSPEND' ? 'SUSPENDED' : action === 'REACTIVATE' ? 'REACTIVATED' : action === 'CANCEL' ? 'CANCELED' : 'TRIAL_EXTENDED',
          fromStatus: sub.status,
          toStatus: status,
          fromPeriodEnd: sub.currentPeriodEnd,
          toPeriodEnd: end,
          reason,
          actorId,
        },
      });
      return { before: { status: sub.status, currentPeriodEnd: sub.currentPeriodEnd }, after: { status: updated.status, currentPeriodEnd: updated.currentPeriodEnd } };
    });
  }

  rule<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      if (error instanceof BillingRuleError) throw new AppError(HttpStatus.CONFLICT, error.code, error.message);
      throw error;
    }
  }
}
