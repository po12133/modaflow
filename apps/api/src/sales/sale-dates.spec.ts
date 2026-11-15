import { localDateStart, periodRange, startOfLocalDay } from './sale-dates.js';

// 2026-11-16 01:30 UTC is still Sunday 2026-11-15 21:30 in La Paz.
const now = new Date('2026-11-16T01:30:00.000Z');

describe('sale periods (Bolivia, UTC-4)', () => {
  it('uses the local business day, not the UTC day', () => {
    expect(startOfLocalDay(now).toISOString()).toBe('2026-11-15T04:00:00.000Z');
    expect(periodRange('today', now)).toEqual({
      gte: new Date('2026-11-15T04:00:00.000Z'),
      lt: new Date('2026-11-16T04:00:00.000Z'),
    });
  });

  it('computes yesterday, last 7 days and this month', () => {
    expect(periodRange('yesterday', now).gte!.toISOString()).toBe('2026-11-14T04:00:00.000Z');
    expect(periodRange('last7', now).gte!.toISOString()).toBe('2026-11-09T04:00:00.000Z');
    expect(periodRange('month', now)).toEqual({
      gte: new Date('2026-11-01T04:00:00.000Z'),
      lt: new Date('2026-12-01T04:00:00.000Z'),
    });
  });

  it('custom ranges include the whole "to" day', () => {
    expect(periodRange('custom', now, '2026-11-01', '2026-11-03')).toEqual({
      gte: localDateStart('2026-11-01'),
      lt: new Date('2026-11-04T04:00:00.000Z'),
    });
    expect(periodRange('all', now)).toEqual({});
  });
});
