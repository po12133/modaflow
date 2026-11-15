import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../../common/app-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { imageKeys } from '../../images/image-processing.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { localDateStart } from '../../sales/sale-dates.js';
import { StorageService } from '../../storage/storage.service.js';
import type { ListPaymentsQueryDto } from './dto/payment-review.dto.js';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service.js';

const dateText = (d: Date) => new Intl.DateTimeFormat('es-BO', { dateStyle: 'long', timeZone: 'America/La_Paz' }).format(d);

@Injectable()
export class PaymentReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly lifecycle: SubscriptionLifecycleService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(q: ListPaymentsQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where: Prisma.PlanChangeRequestWhereInput = {
      amountExpected: { not: null },
      ...(q.status ? { status: q.status } : {}),
      ...(q.planId ? { toPlanId: q.planId } : {}),
      ...(q.tenantId ? { tenantId: q.tenantId } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: localDateStart(q.from) } : {}), ...(q.to ? { lt: new Date(localDateStart(q.to).getTime() + 86_400_000) } : {}) } } : {}),
    };
    const [rows, total, pending] = await this.prisma.$transaction([
      this.prisma.planChangeRequest.findMany({
        where,
        orderBy: [{ status: 'asc' }, { submittedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, status: true, method: true, amountExpected: true, amountConfirmed: true, submittedAt: true, createdAt: true, reviewedAt: true, receiptKey: true, tenant: { select: { id: true, name: true } }, toPlan: { select: { name: true } } },
      }),
      this.prisma.planChangeRequest.count({ where }),
      this.prisma.planChangeRequest.count({ where: { status: 'PENDING', submittedAt: { not: null } } }),
    ]);
    const items = rows.map(({ receiptKey, ...r }) => ({ ...r, hasReceipt: Boolean(receiptKey), amountExpected: r.amountExpected?.toFixed(2) ?? null, amountConfirmed: r.amountConfirmed?.toFixed(2) ?? null }));
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), pendingReview: pending };
  }

  async get(id: string) {
    const r = await this.prisma.planChangeRequest.findFirst({
      where: { id, amountExpected: { not: null } },
      include: {
        tenant: { select: { id: true, name: true, subscription: { select: { status: true, currentPeriodEnd: true, plan: { select: { name: true } } } } } },
        toPlan: { select: { id: true, name: true } },
        fromPlan: { select: { name: true } },
        requestedBy: { select: { name: true, email: true } },
        reviewedBy: { select: { name: true } },
        planVersion: { select: { version: true, priceCents: true } },
        period: true,
      },
    });
    if (!r) throw new AppError(HttpStatus.NOT_FOUND, 'PAYMENT_NOT_FOUND', 'No se encontró la solicitud de pago.');
    const { receiptKey, ...rest } = r;
    return {
      ...rest,
      amountExpected: rest.amountExpected?.toFixed(2) ?? null,
      amountConfirmed: rest.amountConfirmed?.toFixed(2) ?? null,
      period: rest.period ? { ...rest.period, amount: rest.period.amount.toFixed(2) } : null,
      receiptUrl: receiptKey ? await this.storage.signedUrl(imageKeys(receiptKey).main).catch(() => null) : null,
    };
  }

  async approve(id: string, actorId: string, note: string | null, ip: string | null) {
    const result = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM plan_change_requests WHERE id = ${id}::uuid AND amount_expected IS NOT NULL FOR UPDATE`;
      if (!rows[0]) throw new AppError(HttpStatus.NOT_FOUND, 'PAYMENT_NOT_FOUND', 'No se encontró la solicitud de pago.');
      const request = await tx.planChangeRequest.findUniqueOrThrow({ where: { id }, include: { toPlan: { select: { name: true } }, tenant: { select: { name: true } } } });
      if (request.status !== 'PENDING') throw this.reviewed(request.status);
      if (!request.submittedAt || !request.receiptKey) throw new AppError(HttpStatus.CONFLICT, 'RECEIPT_REQUIRED', 'El suscriptor todavía no envió su comprobante.');
      const now = new Date();
      const approved = await tx.planChangeRequest.update({
        where: { id },
        data: { status: 'APPROVED', reviewedById: actorId, reviewedAt: now, reviewNote: note, amountConfirmed: request.amountExpected },
      });
      const { period, previous } = await this.lifecycle.applyPayment(tx, approved, actorId, now);
      await this.audit.record(
        { actorId, action: 'PAYMENT_APPROVED', entityType: 'PaymentRequest', entityId: id, before: { requestStatus: 'PENDING', subscriptionStatus: previous.status, planId: previous.planId, currentPeriodEnd: previous.currentPeriodEnd }, after: { status: 'APPROVED', amountConfirmed: approved.amountConfirmed?.toFixed(2), periodKind: period.kind, periodStart: period.periodStart, periodEnd: period.periodEnd }, reason: note, ip },
        tx,
      );
      const data = { planName: request.toPlan.name, amount: approved.amountConfirmed?.toFixed(2), date: dateText(period.periodEnd) };
      await this.notifications.notify({ audience: 'TENANT', tenantId: request.tenantId, type: 'PAYMENT_APPROVED', dedupeKey: `tenant:payment-approved:${id}`, data }, tx);
      return period;
    });
    return { ...(await this.get(id)), period: { ...result, amount: result.amount.toFixed(2) } };
  }

  async reject(id: string, actorId: string, reason: string, ip: string | null) {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM plan_change_requests WHERE id = ${id}::uuid AND amount_expected IS NOT NULL FOR UPDATE`;
      if (!rows[0]) throw new AppError(HttpStatus.NOT_FOUND, 'PAYMENT_NOT_FOUND', 'No se encontró la solicitud de pago.');
      const request = await tx.planChangeRequest.findUniqueOrThrow({ where: { id }, include: { toPlan: { select: { name: true } } } });
      if (request.status !== 'PENDING') throw this.reviewed(request.status);
      await tx.planChangeRequest.update({ where: { id }, data: { status: 'REJECTED', reviewedById: actorId, reviewedAt: new Date(), reviewNote: reason } });
      await this.audit.record({ actorId, action: 'PAYMENT_REJECTED', entityType: 'PaymentRequest', entityId: id, before: { status: 'PENDING' }, after: { status: 'REJECTED' }, reason, ip }, tx);
      await this.notifications.notify({ audience: 'TENANT', tenantId: request.tenantId, type: 'PAYMENT_REJECTED', dedupeKey: `tenant:payment-rejected:${id}`, data: { planName: request.toPlan.name, reason } }, tx);
    });
    return this.get(id);
  }

  private reviewed(status: string) {
    return new AppError(HttpStatus.CONFLICT, 'PAYMENT_ALREADY_REVIEWED', `Esta solicitud ya fue ${status === 'APPROVED' ? 'aprobada' : status === 'REJECTED' ? 'rechazada' : 'cancelada'}.`);
  }
}
