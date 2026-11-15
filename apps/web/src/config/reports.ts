export { CHART_COLORS } from "@modaflow/ui/config/charts";
export { REPORT_PERIODS, type ReportPeriodKey } from "@modaflow/ui/config/periods";

export const REQUIRED_PLAN = "Pro";

export const ADVANCED_FEATURES = [
  "Ganancia bruta estimada",
  "Gráficos de evolución, categorías y métodos de pago",
  "Comparación con el periodo anterior",
  "Productos más y menos vendidos",
  "Valor del inventario y movimientos",
  "Exportación a Excel y PDF",
];

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
