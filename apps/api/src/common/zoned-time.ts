export const DEFAULT_TIMEZONE = 'America/La_Paz';

export interface LocalDate {
  y: number;
  m: number;
  d: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function wallClock(instant: Date, tz: string) {
  const parts: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(instant)) if (p.type !== 'literal') parts[p.type] = Number(p.value);
  return { y: parts.year!, m: parts.month!, d: parts.day!, h: parts.hour!, mi: parts.minute!, s: parts.second! };
}

export function tzOffsetMs(instant: Date, tz: string): number {
  const w = wallClock(instant, tz);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  return asUtc - (instant.getTime() - instant.getUTCMilliseconds());
}

export function localDateOf(instant: Date, tz: string): LocalDate {
  const w = wallClock(instant, tz);
  return { y: w.y, m: w.m, d: w.d };
}

export function zonedInstant(date: LocalDate, tz: string, hour = 0): Date {
  const guess = Date.UTC(date.y, date.m - 1, date.d, hour);
  const first = tzOffsetMs(new Date(guess), tz);
  let t = guess - first;
  const second = tzOffsetMs(new Date(t), tz);
  if (second !== first) t = guess - second;
  return new Date(t);
}

export function startOfDay(date: LocalDate, tz: string): Date {
  return zonedInstant(date, tz, 0);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const t = new Date(Date.UTC(date.y, date.m - 1, date.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function addMonths(date: LocalDate, months: number): LocalDate {
  const t = new Date(Date.UTC(date.y, date.m - 1 + months, 1));
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth() + 1;
  return { y, m, d: Math.min(date.d, daysInMonth(y, m)) };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function weekday(date: LocalDate): number {
  return (new Date(Date.UTC(date.y, date.m - 1, date.d)).getUTCDay() + 6) % 7;
}

export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return diffDays(b, a);
}

export function parseLocalDate(value: string | undefined | null): LocalDate | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  if (date.y < 2000 || date.y > 2100 || date.m < 1 || date.m > 12 || date.d < 1 || date.d > daysInMonth(date.y, date.m)) return null;
  return date;
}

export function formatLocalDate(date: LocalDate): string {
  return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
}
