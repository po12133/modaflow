import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { SubscriptionLifecycleService } from '../billing/subscription-lifecycle.service.js';
import { AppError } from '../common/app-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { localDateStart } from '../sales/sale-dates.js';
import { effectiveStatus } from '../subscriptions/entitlement-rules.js';
import { effectiveStatusWhere, isUuid } from './admin-status-filter.js';
import type { TenantStatusDto, TenantsQueryDto } from './dto.js';

const DAY_MS = 86_400_000;
const range = (from?: string, to?: string) =>
  from || to ? { ...(from ? { gte: localDateStart(from) } : {}), ...(to ? { lt: new Date(localDateStart(to).getTime() + DAY_MS) } : {}) } : undefined;

@Injectable()
export class AdminTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: SubscriptionLifecycleService,
    private readonly audit: AuditService,
  ) {}

  async list(q: TenantsQueryDto) {
    const now = new Date();
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const search = q.search?.trim();
    const subscription: Prisma.SubscriptionWhereInput = {
      ...(q.status ? effectiveStatusWhere(q.status, now) : {}),
      ...(q.plan ? { plan: { code: q.plan } } : {}),
      ...(range(q.expiresFrom, q.expiresTo) ? { currentPeriodEnd: range(q.expiresFrom, q.expiresTo) } : {}),
    };
    const where: Prisma.TenantWhereInput = {
      ...(Object.keys(subscription).length ? { subscription } : {}),
      ...(range(q.createdFrom, q.createdTo) ? { createdAt: range(q.createdFrom, q.createdTo) } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { stores: { some: { whatsapp: { contains: search.replace(/\s/g, '') } } } },
              { memberships: { some: { role: 'OWNER', user: { email: { contains: search.toLowerCase() } } } } },
              ...(isUuid(search) ? [{ id: search }] : []),
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          createdAt: true,
          stores: { orderBy: { createdAt: 'asc' }, take: 1, select: { whatsapp: true, city: true, slug: true } },
          memberships: { where: { role: 'OWNER' }, take: 1, select: { user: { select: { id: true, name: true, email: true } } } },
          subscription: { select: { status: true, startedAt: true, currentPeriodEnd: true, plan: { select: { code: true, name: true } } } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);
    const items = rows.map((t) => ({
      id: t.id,
      name: t.name,
      createdAt: t.createdAt,
      owner: t.memberships[0]?.user ?? null,
      whatsapp: t.stores[0]?.whatsapp ?? null,
      city: t.stores[0]?.city ?? null,
      plan: t.subscription?.plan ?? null,
      status: t.subscription ? effectiveStatus(t.subscription, now) : null,
      expiresAt: t.subscription?.currentPeriodEnd ?? null,
    }));
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async detail(id: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        stores: { orderBy: { createdAt: 'asc' }, select: { id: true, name: true, slug: true, city: true, whatsapp: true, createdAt: true } },
        memberships: { orderBy: { createdAt: 'asc' }, select: { role: true, createdAt: true, user: { select: { id: true, name: true, email: true, status: true, lastLoginAt: true } } } },
        subscription: { include: { plan: { select: { code: true, name: true, isTrial: true } }, planVersion: { select: { version: true, priceCents: true } } } },
        subscriptionHistory: { orderBy: { createdAt: 'desc' }, take: 30, include: { actor: { select: { name: true } } } },
        subscriptionPeriods: { orderBy: { periodStart: 'desc' }, take: 30, include: { plan: { select: { name: true } } } },
        planChangeRequests: { where: { amountExpected: { not: null } }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, status: true, amountExpected: true, method: true, createdAt: true, submittedAt: true, reviewedAt: true, toPlan: { select: { name: true } } } },
      },
    });
    if (!t) throw new AppError(HttpStatus.NOT_FOUND, 'TENANT_NOT_FOUND', 'No se encontró el negocio.');
    const [products, sales] = await this.prisma.$transaction([
      this.prisma.product.count({ where: { tenantId: id, status: 'ACTIVE' } }),
      this.prisma.sale.count({ where: { tenantId: id, status: 'COMPLETED' } }),
    ]);
    const now = new Date();
    return {
      ...t,
      subscription: t.subscription ? { ...t.subscription, effectiveStatus: effectiveStatus(t.subscription, now) } : null,
      subscriptionPeriods: t.subscriptionPeriods.map((p) => ({ ...p, amount: p.amount.toFixed(2) })),
      planChangeRequests: t.planChangeRequests.map((p) => ({ ...p, amountExpected: p.amountExpected?.toFixed(2) ?? null })),
      usage: { activeProducts: products, completedSales: sales },
    };
  }

  async setStatus(id: string, dto: TenantStatusDto, actorId: string, ip: string | null) {
    const exists = await this.prisma.tenant.count({ where: { id } });
    if (!exists) throw new AppError(HttpStatus.NOT_FOUND, 'TENANT_NOT_FOUND', 'No se encontró el negocio.');
    const change = await this.lifecycle.transition(id, dto.action, actorId, dto.reason);
    await this.audit.record({ actorId, action: dto.action === 'SUSPEND' ? 'TENANT_SUSPENDED' : 'TENANT_REACTIVATED', entityType: 'Tenant', entityId: id, before: change.before, after: change.after, reason: dto.reason, ip });
    return this.detail(id);
  }
}
