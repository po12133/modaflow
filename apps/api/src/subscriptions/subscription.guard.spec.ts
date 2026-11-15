import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { EntitlementsService } from './entitlements.service.js';
import { RequireActiveSubscription, RequireFeature, SubscriptionGuard } from './subscription.guard.js';

class Handlers {
  @RequireActiveSubscription()
  operational() {}

  @RequireFeature('advancedReports')
  reports() {}

  open() {}
}

function contextFor(handler: keyof Handlers): ExecutionContext {
  return {
    getHandler: () => Handlers.prototype[handler],
    getClass: () => Handlers,
    switchToHttp: () => ({ getRequest: () => ({ tenant: { tenantId: 't1', role: 'OWNER' } }) }),
  } as unknown as ExecutionContext;
}

describe('SubscriptionGuard', () => {
  const entitlements = {
    assertOperational: vi.fn().mockResolvedValue({}),
    assertFeature: vi.fn().mockResolvedValue({}),
  };
  const guard = new SubscriptionGuard(new Reflector(), entitlements as unknown as EntitlementsService);

  beforeEach(() => vi.clearAllMocks());

  it('checks the active subscription of the resolved tenant', async () => {
    await expect(guard.canActivate(contextFor('operational'))).resolves.toBe(true);
    expect(entitlements.assertOperational).toHaveBeenCalledWith('t1');
  });

  it('checks plan features', async () => {
    await guard.canActivate(contextFor('reports'));
    expect(entitlements.assertFeature).toHaveBeenCalledWith('t1', 'advancedReports');
  });

  it('propagates the restriction error', async () => {
    entitlements.assertOperational.mockRejectedValueOnce(new Error('SUBSCRIPTION_INACTIVE'));
    await expect(guard.canActivate(contextFor('operational'))).rejects.toThrow('SUBSCRIPTION_INACTIVE');
  });

  it('does nothing on routes without requirements', async () => {
    await expect(guard.canActivate(contextFor('open'))).resolves.toBe(true);
    expect(entitlements.assertOperational).not.toHaveBeenCalled();
  });
});
