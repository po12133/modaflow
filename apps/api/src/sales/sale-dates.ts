import { addDays, DEFAULT_TIMEZONE, localDateOf, parseLocalDate, startOfDay } from '../common/zoned-time.js';

export type SalePeriod = 'today' | 'yesterday' | 'last7' | 'month' | 'custom' | 'all';

export interface DateRange {
  gte?: Date;
  lt?: Date;
}

export function startOfLocalDay(instant: Date, tz = DEFAULT_TIMEZONE): Date {
  return startOfDay(localDateOf(instant, tz), tz);
}

export function localDateStart(date: string, tz = DEFAULT_TIMEZONE): Date {
  const d = parseLocalDate(date);
  if (!d) throw new RangeError(`Invalid date: ${date}`);
  return startOfDay(d, tz);
}

export function periodRange(period: SalePeriod | undefined, now: Date, from?: string, to?: string, tz = DEFAULT_TIMEZONE): DateRange {
  const today = localDateOf(now, tz);
  const day = (offset: number) => startOfDay(addDays(today, offset), tz);
  switch (period) {
    case 'today':
      return { gte: day(0), lt: day(1) };
    case 'yesterday':
      return { gte: day(-1), lt: day(0) };
    case 'last7':
      return { gte: day(-6), lt: day(1) };
    case 'month':
      return {
        gte: startOfDay({ ...today, d: 1 }, tz),
        lt: startOfDay(today.m === 12 ? { y: today.y + 1, m: 1, d: 1 } : { y: today.y, m: today.m + 1, d: 1 }, tz),
      };
    case 'custom': {
      const range: DateRange = {};
      const f = parseLocalDate(from);
      const t = parseLocalDate(to);
      if (f) range.gte = startOfDay(f, tz);
      if (t) range.lt = startOfDay(addDays(t, 1), tz);
      return range;
    }
    default:
      return {};
  }
}
