import { addDays, addMonths, compareDates, formatLocalDate, parseLocalDate, weekday, zonedInstant, type LocalDate } from '../common/zoned-time.js';
import type { Granularity } from './report-period.types.js';
import { MONTHS } from './report-spans.js';

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export interface Bucket {
  key: string;
  label: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: LocalDate, hour = 0) => `${formatLocalDate(d)}T${pad(hour)}`;

export function buckets(from: string, to: string, granularity: Granularity): Bucket[] {
  const start = parseLocalDate(from)!;
  const end = parseLocalDate(to)!;
  const out: Bucket[] = [];
  if (granularity === 'hour') {
    for (let h = 0; h < 24; h++) out.push({ key: dateKey(start, h), label: `${h} h` });
    return out;
  }
  if (granularity === 'day') {
    for (let d = start; compareDates(d, end) <= 0; d = addDays(d, 1)) out.push({ key: dateKey(d), label: `${d.d}/${d.m}` });
    return out;
  }
  if (granularity === 'week') {
    for (let d = addDays(start, -weekday(start)); compareDates(d, end) <= 0; d = addDays(d, 7)) {
      out.push({ key: dateKey(d), label: `Sem. ${d.d}/${d.m}` });
    }
    return out;
  }
  for (let d = { ...start, d: 1 }; compareDates(d, end) <= 0; d = addMonths(d, 1)) {
    out.push({ key: dateKey(d), label: `${MONTHS[d.m - 1]!.slice(0, 3)} ${String(d.y).slice(2)}` });
  }
  return out;
}

export function bucketStart(key: string, tz: string): Date {
  return zonedInstant(parseLocalDate(key.slice(0, 10))!, tz, Number(key.slice(11, 13)));
}
