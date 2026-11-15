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

export function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function formatChange(value: number | null): string | null {
  if (value === null) return null;
  const abs = Math.abs(value).toLocaleString("es-BO", { maximumFractionDigits: 1 });
  return value > 0 ? `+${abs} %` : value < 0 ? `−${abs} %` : "0 %";
}

export function shortMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `Bs ${(value / 1_000_000).toLocaleString("es-BO", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(value) >= 1000) return `Bs ${(value / 1000).toLocaleString("es-BO", { maximumFractionDigits: 1 })} mil`;
  return `Bs ${Math.round(value)}`;
}

const dayFmt = new Intl.DateTimeFormat("es-BO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtDay = (d: string) => dayFmt.format(new Date(`${d}T12:00:00Z`));

export function periodRangeText(p: ReportPeriodView): string {
  return p.from === p.to ? fmtDay(p.from) : `${fmtDay(p.from)} – ${fmtDay(p.to)}`;
}

