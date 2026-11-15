import { arpuCents, conversionPct, mrrCents } from '../admin/admin-metrics.js';
import { addMonthsUtc, assertTransition, BillingRuleError, extendedTrialEnd, monthlyRecurringCents, periodEnd, plannedPeriod, reactivatedStatus } from './billing-rules.js';

const iso = (d: Date) => d.toISOString();
const monthly = { billingPeriod: 'MONTHLY' as const, durationDays: null };
const now = new Date('2026-11-15T15:00:00.000Z');

describe('billing rules', () => {
  it('adds calendar months clamping the day', () => {
    expect(iso(addMonthsUtc(new Date('2026-01-31T10:00:00Z'), 1))).toBe('2026-02-28T10:00:00.000Z');
    expect(iso(addMonthsUtc(new Date('2028-01-31T10:00:00Z'), 1))).toBe('2028-02-29T10:00:00.000Z');
    expect(iso(addMonthsUtc(new Date('2026-12-15T10:00:00Z'), 1))).toBe('2027-01-15T10:00:00.000Z');
    expect(iso(periodEnd(now, { billingPeriod: 'TRIAL', durationDays: 14 }))).toBe('2026-11-29T15:00:00.000Z');
  });

  it('renews an active paid plan from its current end, not from today', () => {
    const end = new Date('2026-12-01T12:00:00Z');
    const p = plannedPeriod({ status: 'ACTIVE', planId: 'pro', planIsTrial: false, currentPeriodEnd: end }, 'ACTIVE', 'pro', monthly, now);
    expect(p).toEqual({ kind: 'RENEWAL', start: end, end: new Date('2027-01-01T12:00:00Z') });
  });

  it('activates from approval date after a trial or an expired plan', () => {
    const trial = plannedPeriod({ status: 'TRIALING', planId: 'gratis', planIsTrial: true, currentPeriodEnd: new Date('2026-11-20T00:00:00Z') }, 'TRIALING', 'pro', monthly, now);
    expect([trial.kind, iso(trial.start), iso(trial.end)]).toEqual(['ACTIVATION', iso(now), '2026-12-15T15:00:00.000Z']);
    const expired = plannedPeriod({ status: 'ACTIVE', planId: 'pro', planIsTrial: false, currentPeriodEnd: new Date('2026-11-01T00:00:00Z') }, 'EXPIRED', 'pro', monthly, now);
    expect([expired.kind, iso(expired.start)]).toEqual(['ACTIVATION', iso(now)]);
  });

  it('changes plan immediately when moving between paid plans', () => {
    const p = plannedPeriod({ status: 'ACTIVE', planId: 'basico', planIsTrial: false, currentPeriodEnd: new Date('2026-12-01T00:00:00Z') }, 'ACTIVE', 'pro', monthly, now);
    expect([p.kind, iso(p.start)]).toEqual(['PLAN_CHANGE', iso(now)]);
  });

  it('refuses payments for suspended subscriptions', () => {
    expect(() => plannedPeriod({ status: 'SUSPENDED', planId: 'pro', planIsTrial: false, currentPeriodEnd: now }, 'SUSPENDED', 'pro', monthly, now)).toThrow(BillingRuleError);
  });

  it('validates administrative transitions', () => {
    expect(() => assertTransition('SUSPEND', 'ACTIVE')).not.toThrow();
    expect(() => assertTransition('SUSPEND', 'SUSPENDED')).toThrow(/suspender/);
    expect(() => assertTransition('REACTIVATE', 'ACTIVE')).toThrow(BillingRuleError);
    expect(() => assertTransition('CANCEL', 'CANCELED')).toThrow(BillingRuleError);
    expect(() => assertTransition('EXTEND_TRIAL', 'EXPIRED', true)).not.toThrow();
    expect(() => assertTransition('EXTEND_TRIAL', 'ACTIVE', false)).toThrow(BillingRuleError);
  });

  it('reactivates to the right state', () => {
    expect(reactivatedStatus('ACTIVE', new Date('2026-12-01T00:00:00Z'), now)).toBe('ACTIVE');
    expect(reactivatedStatus('TRIALING', new Date('2026-12-01T00:00:00Z'), now)).toBe('TRIALING');
    expect(reactivatedStatus('ACTIVE', new Date('2026-11-01T00:00:00Z'), now)).toBe('EXPIRED');
  });

  it('extends trials from the later of today or the current end', () => {
    expect(iso(extendedTrialEnd(new Date('2026-11-10T00:00:00Z'), 7, now))).toBe('2026-11-22T15:00:00.000Z');
    expect(iso(extendedTrialEnd(new Date('2026-11-20T00:00:00Z'), 7, now))).toBe('2026-11-27T00:00:00.000Z');
  });

  it('computes MRR, ARPU and conversion without counting trials', () => {
    expect(monthlyRecurringCents({ ...monthly, priceCents: 6900 })).toBe(6900);
    expect(monthlyRecurringCents({ billingPeriod: 'TRIAL', durationDays: 14, priceCents: 0 })).toBe(0);
    const mrr = mrrCents([{ ...monthly, priceCents: 6900 }, { ...monthly, priceCents: 3000 }, { ...monthly, priceCents: 11900 }]);
    expect(mrr).toBe(21800);
    expect(arpuCents(mrr, 3)).toBe(7267);
    expect(arpuCents(0, 0)).toBeNull();
    expect(conversionPct(1, 3)).toBe(33.3);
    expect(conversionPct(0, 0)).toBeNull();
  });
});
