import { PLAN_CATALOG } from '../plans/plan-catalog.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { addDays } from './entitlement-rules.js';
import { EntitlementsService } from './entitlements.service.js';

const start = new Date('2026-11-01T12:00:00.000Z');

function makeService(planCode: string, opts: { end?: Date; aiUsed?: number; status?: string; products?: number } = {}) {
  const plan = { id: `plan-${planCode}`, currency: 'BOB', ...PLAN_CATALOG.find((p) => p.code === planCode)! };
  const sub = {
    id: 'sub-1',
    tenantId: 't1',
    status: opts.status ?? (plan.isTrial ? 'TRIALING' : 'ACTIVE'),
    startedAt: start,
    currentPeriodEnd: opts.end ?? addDays(start, 14),
    plan,
  };
  const prisma = {
    subscription: { findUnique: vi.fn().mockResolvedValue(sub), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    subscriptionUsage: { findUnique: vi.fn().mockResolvedValue(opts.aiUsed == null ? null : { used: opts.aiUsed }) },
    tenantMembership: { count: vi.fn().mockResolvedValue(1) },
    store: { count: vi.fn().mockResolvedValue(1) },
    product: { count: vi.fn().mockResolvedValue(opts.products ?? 0) },
  };
  return { service: new EntitlementsService(prisma as unknown as PrismaService), prisma };
}

describe('EntitlementsService', () => {
  it('summarizes an active trial', async () => {
    const { service } = makeService('gratis');
    const ent = await service.getForTenant('t1', addDays(start, 4));
    expect(ent.status).toBe('TRIALING');
    expect(ent.isOperational).toBe(true);
    expect(ent.daysRemaining).toBe(10);
    expect(ent.dataRetentionUntil).toBeNull();
    expect(ent.limits.products).toEqual({ limit: 30, used: 0 });
    expect(ent.limits.users).toEqual({ limit: 1, used: 1 });
    expect(ent.features.onlineCatalog).toBe(true);
  });

  it('treats an elapsed trial as expired from its dates (the expiry job persists it) and sets the retention date', async () => {
    const { service, prisma } = makeService('gratis');
    const ent = await service.getForTenant('t1', addDays(start, 15));
    expect(ent.status).toBe('EXPIRED');
    expect(ent.isOperational).toBe(false);
    expect(ent.daysRemaining).toBe(0);
    expect(ent.dataRetentionUntil?.toISOString()).toBe(addDays(start, 44).toISOString());
    expect(ent.features.onlineCatalog).toBe(false);
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
  });

  it('blocks new operations when the subscription is not active', async () => {
    const { service } = makeService('gratis', { end: addDays(new Date(), -1) });
    await expect(service.assertOperational('t1')).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_INACTIVE' },
    });
  });

  it('rejects a feature not included in the plan', async () => {
    const { service } = makeService('basico', { end: addDays(new Date(), 20) });
    await expect(service.assertFeature('t1', 'onlineCatalog')).rejects.toMatchObject({
      response: { code: 'FEATURE_NOT_IN_PLAN', feature: 'onlineCatalog' },
    });
    await expect(service.assertFeature('t1', 'inventoryAndSales')).resolves.toBeDefined();
  });

  it('enforces usage limits (trial: 10 AI analyses in total)', async () => {
    const { service } = makeService('gratis', { end: addDays(new Date(), 5), aiUsed: 10 });
    await expect(service.assertWithinLimit('t1', 'aiAnalyses')).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT_REACHED', max: 10, used: 10 },
    });
    const ok = makeService('gratis', { end: addDays(new Date(), 5), aiUsed: 9 });
    await expect(ok.service.assertWithinLimit('t1', 'aiAnalyses')).resolves.toBeDefined();
  });

  it('enforces the product limit with the real count of active products', async () => {
    const full = makeService('gratis', { end: addDays(new Date(), 5), products: 30 });
    await expect(full.service.assertWithinLimit('t1', 'products')).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT_REACHED', limit: 'products', max: 30, used: 30 },
    });
    expect(full.prisma.product.count).toHaveBeenCalledWith({ where: { tenantId: 't1', status: 'ACTIVE' } });
    const room = makeService('gratis', { end: addDays(new Date(), 5), products: 29 });
    await expect(room.service.assertWithinLimit('t1', 'products')).resolves.toBeDefined();
  });

  it('enforces user limits per plan', async () => {
    const { service } = makeService('gratis', { end: addDays(new Date(), 5) });
    await expect(service.assertWithinLimit('t1', 'users')).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT_REACHED', limit: 'users' },
    });
  });
});
