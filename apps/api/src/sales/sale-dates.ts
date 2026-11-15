/** Business day boundaries in Bolivia (America/La_Paz: UTC-4 all year, no DST). */
const OFFSET_MS = -4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SalePeriod = 'today' | 'yesterday' | 'last7' | 'month' | 'custom' | 'all';

export interface DateRange {
  /** Inclusive. */
  gte?: Date;
  /** Exclusive. */
  lt?: Date;
}

/** UTC instant of 00:00 (Bolivia) of the local day containing `instant`. */
export function startOfLocalDay(instant: Date): Date {
  const local = instant.getTime() + OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - OFFSET_MS);
}

/** UTC instant of 00:00 (Bolivia) for a "YYYY-MM-DD" local date. */
export function localDateStart(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!) - OFFSET_MS);
}

export function periodRange(period: SalePeriod | undefined, now: Date, from?: string, to?: string): DateRange {
  const today = startOfLocalDay(now);
  switch (period) {
    case 'today':
      return { gte: today, lt: new Date(today.getTime() + DAY_MS) };
    case 'yesterday':
      return { gte: new Date(today.getTime() - DAY_MS), lt: today };
    case 'last7':
      // Today plus the 6 previous days.
      return { gte: new Date(today.getTime() - 6 * DAY_MS), lt: new Date(today.getTime() + DAY_MS) };
    case 'month': {
      const local = new Date(now.getTime() + OFFSET_MS);
      const first = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET_MS;
      const next = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - OFFSET_MS;
      return { gte: new Date(first), lt: new Date(next) };
    }
    case 'custom': {
      const range: DateRange = {};
      if (from) range.gte = localDateStart(from);
      if (to) range.lt = new Date(localDateStart(to).getTime() + DAY_MS);
      return range;
    }
    default:
      return {};
  }
}
