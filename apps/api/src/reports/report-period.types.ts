export const REPORT_PERIODS = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'last7',
  'this_fortnight',
  'last_fortnight',
  'this_month',
  'last_month',
  'last30',
  'this_year',
  'custom',
] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export type Granularity = 'hour' | 'day' | 'week' | 'month';

export interface Window {
  from: string;
  to: string;
  start: Date;
  end: Date;
}

export interface ResolvedPeriod extends Window {
  key: ReportPeriod;
  label: string;
  timezone: string;
  inProgress: boolean;
  effectiveEnd: Date;
  granularity: Granularity;
  previous: Window & { label: string; comparedUntil: Date };
}
