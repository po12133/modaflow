import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AdminAction } from '../billing/billing-rules.js';
import { latestVersion } from '../billing/plan-versions.js';
import { SubscriptionLifecycleService } from '../billing/subscription-lifecycle.service.js';
import { AppError } from '../common/app-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fromCents } from '../sales/sale-math.js';
import { effectiveStatus } from '../subscriptions/entitlement-rules.js';
import { effectiveStatusWhere } from './admin-status-filter.js';
import type { ChangePlanDto, ManualPaymentDto, SubscriptionsQueryDto } from './dto.js';

const dateText = (d: Date) => new Intl.DateTimeFormat('es-BO', { dateStyle: 'long', timeZone: 'America/La_Paz' }).format(d);

@Injectable()
export class AdminSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: SubscriptionLifecycleService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(q: SubscriptionsQueryDto) {
    const now = new Date();
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where: Prisma.SubscriptionWhereInput = {
      ...(q.status ? effectiveStatusWhere(q.status, now) : {}),
      ...(q.plan ? { plan: { code: q.plan } } : {}),
      ...(q.search?.trim() ? { tenant: { name: { contains: q.search.trim(), mode: 'insensitive' } } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where,
        orderBy: [{ currentPeriodEnd: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          tenant: { select: { id: true, name: true } },
          plan: { select: { code: true, name: true } },
          planVersion: { select: { version: true, priceCents: true } },
          periods: { where: { paymentRequestId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, amount: true } },
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);
    const items = rows.map(({ periods, ...s }) => ({
      ...s,
      effectiveStatus: effectiveStatus(s, now),
      periodPrice: s.planVersion ? fromCents(s.planVersion.priceCents) : null,
      lastPayment: periods[0] ? { date: periods[0].createdAt, amount: periods[0].amount.toFixed(2) } : null,
      nextRenewal: s.status === 'ACTIVE' ? s.currentPeriodEnd : null,
    }));
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async detail(id: string) {
    const s = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, name: true } },
        plan: { select: { code: true, name: true, isTrial: true } },
        planVersion: true,
        periods: { orderBy: { periodStart: 'desc' }, take: 50 },
        history: { orderBy: { createdAt: 'desc' }, take: 50, include: { actor: { select: { name: true } } } },
      },
    });
    if (!s) throw new AppError(HttpStatus.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND', 'No se encontró la suscripción.');
    return { ...s, effectiveStatus: effectiveStatus(s, new Date()), periods: s.periods.map((p) => ({ ...p, amount: p.amount.toFixed(2) })) };
  }

  async tenantOf(id: string): Promise<string> {
    const sub = await this.prisma.subscription.findUnique({ where: { id }, select: { tenantId: true } });
    if (!sub) throw new AppError(HttpStatus.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND', 'No se encontró la suscripción.');
    return sub.tenantId;
  }

  async transition(id: string, action: AdminAction, actorId: string, reason: string, ip: string | null, days = 0) {
    const tenantId = await this.tenantOf(id);
    const change = await this.lifecycle.transition(tenantId, action, actorId, reason, days);
    await this.audit.record({ actorId, action: `SUBSCRIPTION_${action}`, entityType: 'Subscription', entityId: id, before: change.before, after: change.after, reason, ip });
    return change;
  }

  async manualPayment(id: string, dto: ManualPaymentDto | ChangePlanDto, actorId: string, ip: string | null) {
    if (!dto.amountVerified) throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Confirma que verificaste el importe recibido.', { errors: { amountVerified: ['Confirma que verificaste el importe recibido.'] } });
    const tenantId = await this.tenantOf(id);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lifecycle.lock(tx, tenantId);
      const plan = 'planCode' in dto ? await tx.plan.findUnique({ where: { code: dto.planCode } }) : current.plan;
      if (!plan || plan.isTrial || !plan.isActive || plan.priceCents <= 0) throw new AppError(HttpStatus.BAD_REQUEST, 'PLAN_NOT_PAYABLE', 'Ese plan no se puede contratar.');
      const version = await latestVersion(tx, plan.id);
      const now = new Date();
      const request = await tx.planChangeRequest.create({
        data: {
          tenantId,
          requestedById: actorId,
          fromPlanId: current.planId,
          toPlanId: plan.id,
          planVersionId: version.id,
          amountExpected: fromCents(version.priceCents),
          amountConfirmed: fromCents(version.priceCents),
          method: dto.method,
          status: 'APPROVED',
          submittedAt: now,
          reviewedById: actorId,
          reviewedAt: now,
          reviewNote: dto.reason,
        },
      });
      const { period, previous } = await this.lifecycle.applyPayment(tx, request, actorId, now);
      await this.audit.record({ actorId, action: `SUBSCRIPTION_${period.kind}`, entityType: 'Subscription', entityId: id, before: previous, after: { planId: plan.id, periodStart: period.periodStart, periodEnd: period.periodEnd, amount: period.amount.toFixed(2), paymentRequestId: request.id }, reason: dto.reason, ip }, tx);
      await this.notifications.notify({ audience: 'TENANT', tenantId, type: 'SUBSCRIPTION_ACTIVATED', dedupeKey: `tenant:activated:${request.id}`, data: { planName: plan.name, date: dateText(period.periodEnd) } }, tx);
      return { paymentRequestId: request.id, period: { ...period, amount: period.amount.toFixed(2) } };
    });
  }
}
