import { addDays, addMonths, compareDates, diffDays, localDateOf, parseLocalDate } from '../common/zoned-time.js';
import type { ReportPeriod, ResolvedPeriod } from './report-period.types.js';
import { fortnightOf, granularityFor, monthOf, previousFortnight, shiftBack, spanLabel, toWindow, weekOf, type Span } from './report-spans.js';

export const MAX_CUSTOM_DAYS = 731;

export class PeriodError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

export function resolvePeriod(
  key: ReportPeriod | undefined,
  tz: string,
  now: Date,
  custom?: { from?: string; to?: string },
): ResolvedPeriod {
  const period: ReportPeriod = key ?? 'this_month';
  const today = localDateOf(now, tz);
  let span: Span;
  let prev: Span;
  let label: string;
  switch (period) {
    case 'today':
      span = { from: today, to: today };
      prev = shiftBack(span);
      label = 'Hoy';
      break;
    case 'yesterday':
      span = { from: addDays(today, -1), to: addDays(today, -1) };
      prev = shiftBack(span);
      label = 'Ayer';
      break;
    case 'this_week':
      span = weekOf(today);
      prev = shiftBack(span);
      label = 'Esta semana';
      break;
    case 'last_week':
      span = shiftBack(weekOf(today));
      prev = shiftBack(span);
      label = 'Semana anterior';
      break;
    case 'last7':
      span = { from: addDays(today, -6), to: today };
      prev = shiftBack(span);
      label = 'Últimos 7 días';
      break;
    case 'this_fortnight':
      span = fortnightOf(today);
      prev = previousFortnight(span);
      label = 'Esta quincena';
      break;
    case 'last_fortnight':
      span = previousFortnight(fortnightOf(today));
      prev = previousFortnight(span);
      label = 'Quincena anterior';
      break;
    case 'this_month':
      span = monthOf(today);
      prev = monthOf(addMonths(span.from, -1));
      label = 'Este mes';
      break;
    case 'last_month':
      span = monthOf(addMonths(today, -1));
      prev = monthOf(addMonths(span.from, -1));
      label = 'Mes anterior';
      break;
    case 'last30':
      span = { from: addDays(today, -29), to: today };
      prev = shiftBack(span);
      label = 'Últimos 30 días';
      break;
    case 'this_year':
      span = { from: { y: today.y, m: 1, d: 1 }, to: { y: today.y, m: 12, d: 31 } };
      prev = { from: { y: today.y - 1, m: 1, d: 1 }, to: { y: today.y - 1, m: 12, d: 31 } };
      label = 'Este año';
      break;
    case 'custom': {
      const from = parseLocalDate(custom?.from);
      const to = parseLocalDate(custom?.to);
      if (!from) throw new PeriodError('from', 'Indica una fecha inicial válida.');
      if (!to) throw new PeriodError('to', 'Indica una fecha final válida.');
      if (compareDates(from, to) > 0) throw new PeriodError('from', 'La fecha inicial no puede ser posterior a la fecha final.');
      if (diffDays(from, to) + 1 > MAX_CUSTOM_DAYS) throw new PeriodError('to', 'El periodo personalizado puede tener como máximo 2 años.');
      span = { from, to };
      prev = shiftBack(span);
      label = spanLabel(span);
      break;
    }
  }

  const current = toWindow(span, tz);
  const previous = toWindow(prev, tz);
  const effectiveEnd = new Date(Math.max(current.start.getTime(), Math.min(current.end.getTime(), now.getTime())));
  const inProgress = current.end.getTime() > now.getTime();
  const elapsed = effectiveEnd.getTime() - current.start.getTime();
  const comparedUntil = inProgress ? new Date(Math.min(previous.start.getTime() + elapsed, previous.end.getTime())) : previous.end;
  return {
    key: period,
    label,
    timezone: tz,
    ...current,
    inProgress,
    effectiveEnd,
    granularity: granularityFor(span),
    previous: { ...previous, label: spanLabel(prev), comparedUntil },
  };
}
