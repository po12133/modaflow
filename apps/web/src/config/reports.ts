export const REQUIRED_PLAN = "Pro";

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

export const ADVANCED_FEATURES = [
  "Ganancia bruta estimada",
  "Gráficos de evolución, categorías y métodos de pago",
  "Comparación con el periodo anterior",
  "Productos más y menos vendidos",
  "Valor del inventario y movimientos",
  "Exportación a Excel y PDF",
];

export const CHART_COLORS = {
  current: "#6C4CF5",
  previous: "#D63C74",
  grid: "#ebe9f3",
  axis: "#6c6889",
  label: "#3b3657",
  ink: "#16132b",
} as const;

export const PRODUCT_SORTS: [string, string][] = [
  ["units_desc", "Más vendidos (prendas)"],
  ["revenue_desc", "Más vendidos (ingresos)"],
  ["units_asc", "Menos vendidos"],
];

export const LOW_STOCK_OPTIONS: [string, string][] = [
  ["", "El de cada producto"],
  ["1", "1 unidad o menos"],
  ["2", "2 unidades o menos"],
  ["5", "5 unidades o menos"],
];

export const STOCK_INCREASES = new Set(["INITIAL", "STOCK_IN", "ADJUSTMENT_IN", "SALE_CANCEL"]);
