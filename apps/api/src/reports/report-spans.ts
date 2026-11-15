import { addDays, compareDates, daysInMonth, diffDays, formatLocalDate, startOfDay, weekday, type LocalDate } from '../common/zoned-time.js';
import type { Granularity, Window } from './report-period.types.js';

export interface Span {
  from: LocalDate;
  to: LocalDate;
}

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function fortnightOf(date: LocalDate): Span {
  return date.d <= 15
    ? { from: { ...date, d: 1 }, to: { ...date, d: 15 } }
    : { from: { ...date, d: 16 }, to: { ...date, d: daysInMonth(date.y, date.m) } };
}

export function previousFortnight(span: Span): Span {
  return span.from.d === 1 ? fortnightOf(addDays(span.from, -1)) : fortnightOf({ ...span.from, d: 1 });
}

export function monthOf(date: LocalDate): Span {
  return { from: { ...date, d: 1 }, to: { ...date, d: daysInMonth(date.y, date.m) } };
}

export function weekOf(date: LocalDate): Span {
  const from = addDays(date, -weekday(date));
  return { from, to: addDays(from, 6) };
}

export function shiftBack(span: Span): Span {
  const days = diffDays(span.from, span.to) + 1;
  return { from: addDays(span.from, -days), to: addDays(span.to, -days) };
}

function shortDate(d: LocalDate, withYear = false): string {
  return `${d.d} ${MONTHS[d.m - 1]!.slice(0, 3)}${withYear ? ` ${d.y}` : ''}`;
}

export function spanLabel(span: Span): string {
  if (compareDates(span.from, span.to) === 0) return shortDate(span.from, true);
  const sameYear = span.from.y === span.to.y;
  return `${shortDate(span.from, !sameYear)} – ${shortDate(span.to, true)}`;
}

export function granularityFor(span: Span): Granularity {
  const days = diffDays(span.from, span.to) + 1;
  if (days <= 1) return 'hour';
  if (days <= 62) return 'day';
  if (days <= 186) return 'week';
  return 'month';
}

export function toWindow(span: Span, tz: string): Window {
  return {
    from: formatLocalDate(span.from),
    to: formatLocalDate(span.to),
    start: startOfDay(span.from, tz),
    end: startOfDay(addDays(span.to, 1), tz),
  };
}
