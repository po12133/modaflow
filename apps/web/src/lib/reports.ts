import { REPORT_PERIODS } from "@/config/reports";
import type { PeriodParams, ReportPeriodView } from "@/types/reports";

export function periodParams(sp: Record<string, string | string[] | undefined>): PeriodParams {
  const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
  const period = one(sp.period);
  const valid = REPORT_PERIODS.some(([k]) => k === period) ? period : undefined;
  const date = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  if (valid !== "custom") return { period: valid };
  const from = date(one(sp.from));
  const to = date(one(sp.to));
  return from && to && from <= to ? { period: valid, from, to } : {};
}


const dayFmt = new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtDay = (d: string) => dayFmt.format(new Date(`${d}T12:00:00Z`));

export function periodRangeText(p: ReportPeriodView): string {
  return p.from === p.to ? fmtDay(p.from) : `${fmtDay(p.from)} – ${fmtDay(p.to)}`;
}

