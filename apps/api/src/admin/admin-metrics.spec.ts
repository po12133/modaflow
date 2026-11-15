import { arpuCents, conversionPct, mrrCents } from './admin-metrics.js';

const monthly = { billingPeriod: 'MONTHLY' as const, durationDays: null };

describe('admin metrics', () => {
  it('computes MRR, ARPU and conversion without counting trials', () => {
    const mrr = mrrCents([{ ...monthly, priceCents: 6900 }, { ...monthly, priceCents: 3000 }, { ...monthly, priceCents: 11900 }]);
    expect(mrr).toBe(21800);
    expect(arpuCents(mrr, 3)).toBe(7267);
    expect(arpuCents(0, 0)).toBeNull();
    expect(conversionPct(1, 3)).toBe(33.3);
    expect(conversionPct(0, 0)).toBeNull();
  });
});
