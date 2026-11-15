export const REPORT_PERIODS = [
  ["today", "Hoy"],
  ["yesterday", "Ayer"],
  ["this_week", "Esta semana"],
  ["last_week", "Semana anterior"],
  ["last7", "Últimos 7 días"],
  ["this_fortnight", "Esta quincena"],
  ["last_fortnight", "Quincena anterior"],
  ["this_month", "Este mes"],
  ["last_month", "Mes anterior"],
  ["last30", "Últimos 30 días"],
  ["this_year", "Este año"],
  ["custom", "Personalizado"],
] as const;
export type ReportPeriodKey = (typeof REPORT_PERIODS)[number][0];
