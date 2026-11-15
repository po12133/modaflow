import { localDateOf, startOfDay, zonedInstant } from '../common/zoned-time.js';
import { buckets, percentChange } from './report-buckets.js';
import { PeriodError, resolvePeriod } from './report-periods.js';

const TZ = 'America/La_Paz';
// Sunday 2026-11-15 21:30 in La Paz (already Monday 01:30 in UTC).
const now = new Date('2026-11-16T01:30:00.000Z');
const iso = (d: Date) => d.toISOString();

describe('zoned time', () => {
  it('uses the store day, not the UTC or server day', () => {
    expect(localDateOf(now, TZ)).toEqual({ y: 2026, m: 11, d: 15 });
    expect(iso(startOfDay({ y: 2026, m: 11, d: 15 }, TZ))).toBe('2026-11-15T04:00:00.000Z');
    expect(iso(startOfDay({ y: 2026, m: 11, d: 15 }, 'America/Lima'))).toBe('2026-11-15T05:00:00.000Z');
  });

  it('handles daylight saving time zones', () => {
    // Santiago switches to UTC-3 on 2026-09-06; midnight that day is still UTC-4.
    expect(iso(zonedInstant({ y: 2026, m: 7, d: 1 }, 'America/Santiago'))).toBe('2026-07-01T04:00:00.000Z');
    expect(iso(zonedInstant({ y: 2026, m: 12, d: 1 }, 'America/Santiago'))).toBe('2026-12-01T03:00:00.000Z');
  });
});

describe('report periods', () => {
  it('today vs yesterday up to the same hour', () => {
    const p = resolvePeriod('today', TZ, now);
    expect([p.from, p.to]).toEqual(['2026-11-15', '2026-11-15']);
    expect(iso(p.start)).toBe('2026-11-15T04:00:00.000Z');
    expect(iso(p.end)).toBe('2026-11-16T04:00:00.000Z');
    expect(p.inProgress).toBe(true);
    expect(p.granularity).toBe('hour');
    expect(p.previous.from).toBe('2026-11-14');
    expect(iso(p.previous.comparedUntil)).toBe('2026-11-15T01:30:00.000Z'); // 14 Nov 21:30 local
  });

  it('weeks start on Monday', () => {
    const w = resolvePeriod('this_week', TZ, now);
    expect([w.from, w.to]).toEqual(['2026-11-09', '2026-11-15']);
    const lw = resolvePeriod('last_week', TZ, now);
    expect([lw.from, lw.to, lw.previous.from, lw.previous.to]).toEqual(['2026-11-02', '2026-11-08', '2026-10-26', '2026-11-01']);
    expect(lw.inProgress).toBe(false);
    expect(lw.previous.comparedUntil).toEqual(lw.previous.end);
  });

  it('fortnights are days 1-15 and 16-end of month', () => {
    const f = resolvePeriod('this_fortnight', TZ, now);
    expect([f.from, f.to, f.previous.from, f.previous.to]).toEqual(['2026-11-01', '2026-11-15', '2026-10-16', '2026-10-31']);
    const lf = resolvePeriod('last_fortnight', TZ, now);
    expect([lf.from, lf.to, lf.previous.from, lf.previous.to]).toEqual(['2026-10-16', '2026-10-31', '2026-10-01', '2026-10-15']);
    const leap = resolvePeriod('this_fortnight', TZ, new Date('2028-02-20T15:00:00Z'));
    expect([leap.from, leap.to]).toEqual(['2028-02-16', '2028-02-29']);
  });

  it('months compare the same elapsed time while in progress', () => {
    const m = resolvePeriod('this_month', TZ, now);
    expect([m.from, m.to, m.previous.from, m.previous.to]).toEqual(['2026-11-01', '2026-11-30', '2026-10-01', '2026-10-31']);
    expect(iso(m.start)).toBe('2026-11-01T04:00:00.000Z');
    expect(iso(m.end)).toBe('2026-12-01T04:00:00.000Z');
    // 14 days 21.5 hours elapsed → October 15th 21:30 local.
    expect(iso(m.previous.comparedUntil)).toBe('2026-10-16T01:30:00.000Z');
    const lm = resolvePeriod('last_month', TZ, now);
    expect([lm.from, lm.to, lm.previous.from, lm.previous.to]).toEqual(['2026-10-01', '2026-10-31', '2026-09-01', '2026-09-30']);
    expect(lm.inProgress).toBe(false);
    // March 31st: the previous month is February (no day overflow).
    const mar = resolvePeriod('last_month', TZ, new Date('2026-03-31T20:00:00Z'));
    expect([mar.from, mar.to]).toEqual(['2026-02-01', '2026-02-28']);
  });

  it('rolling windows, year and default', () => {
    expect(resolvePeriod('last7', TZ, now).from).toBe('2026-11-09');
    const l30 = resolvePeriod('last30', TZ, now);
    expect([l30.from, l30.to, l30.previous.from, l30.previous.to]).toEqual(['2026-10-17', '2026-11-15', '2026-09-17', '2026-10-16']);
    const y = resolvePeriod('this_year', TZ, now);
    expect([y.from, y.to, y.granularity, y.previous.from]).toEqual(['2026-01-01', '2026-12-31', 'month', '2025-01-01']);
    expect(resolvePeriod(undefined, TZ, now).key).toBe('this_month');
  });

  it('validates custom ranges', () => {
    const c = resolvePeriod('custom', TZ, now, { from: '2026-11-01', to: '2026-11-10' });
    expect([c.previous.from, c.previous.to, c.granularity, c.inProgress]).toEqual(['2026-10-22', '2026-10-31', 'day', false]);
    expect(resolvePeriod('custom', TZ, now, { from: '2026-01-01', to: '2026-04-30' }).granularity).toBe('week');
    expect(() => resolvePeriod('custom', TZ, now, { from: '2026-11-10', to: '2026-11-01' })).toThrow(PeriodError);
    expect(() => resolvePeriod('custom', TZ, now, { from: '2026-02-30', to: '2026-03-01' })).toThrow(PeriodError);
    expect(() => resolvePeriod('custom', TZ, now, { from: '2020-01-01', to: '2026-01-01' })).toThrow(/2 años/);
    expect(() => resolvePeriod('custom', TZ, now, {})).toThrow(PeriodError);
  });

  it('builds every bucket, including empty ones', () => {
    expect(buckets('2026-11-15', '2026-11-15', 'hour')).toHaveLength(24);
    const days = buckets('2026-11-09', '2026-11-15', 'day');
    expect(days.map((b) => b.key)).toEqual(['2026-11-09T00', '2026-11-10T00', '2026-11-11T00', '2026-11-12T00', '2026-11-13T00', '2026-11-14T00', '2026-11-15T00']);
    // ISO weeks start on Monday, like PostgreSQL date_trunc('week').
    expect(buckets('2026-11-01', '2026-11-30', 'week')[0]!.key).toBe('2026-10-26T00');
    expect(buckets('2026-01-01', '2026-12-31', 'month')).toHaveLength(12);
  });

  it('percent change never divides by zero', () => {
    expect(percentChange(500000, 400000)).toBe(25);
    expect(percentChange(300, 400)).toBe(-25);
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
    expect(percentChange(1, 3)).toBe(-66.7);
  });
});
