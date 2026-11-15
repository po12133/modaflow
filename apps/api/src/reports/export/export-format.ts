import type { ExportReport } from '../dto.js';
import type { MOVEMENT_TYPES } from '../inventory-stats.service.js';
import { decimalToCents } from '../report-math.js';
import type { ResolvedPeriod } from '../report-period.types.js';

export const PDF_MAX_ROWS = 2000;
export const PRODUCT_BATCH = 500;
export const MONEY_FMT = '"Bs" #,##0.00';
export const BRAND = '6C4CF5';

export const TITLES: Record<ExportReport, string> = {
  summary: 'Resumen de estadísticas',
  sales: 'Reporte de ventas',
  products: 'Productos vendidos',
  inventory: 'Reporte de inventario',
};

export const MOVEMENT_LABELS: Record<(typeof MOVEMENT_TYPES)[number], string> = {
  INITIAL: 'Entrada inicial',
  STOCK_IN: 'Entrada de mercadería',
  MANUAL_OUT: 'Salida manual',
  ADJUSTMENT_IN: 'Ajuste positivo',
  ADJUSTMENT_OUT: 'Ajuste negativo',
  SALE: 'Salida por venta',
  SALE_CANCEL: 'Restitución por anulación',
};

export const STATUS_LABELS = { COMPLETED: 'Completada', CANCELED: 'Anulada' } as const;

export interface ExportHeader {
  store: string;
  title: string;
  period: string;
  generatedAt: Date;
  tz: string;
}

export const toNumber = (amount: string) => decimalToCents(amount) / 100;

export const formatChange = (v: number | null) => (v == null ? 'Sin base de comparación' : `${v > 0 ? '+' : ''}${v.toLocaleString('es-BO')} %`);

export function localDateTimeText(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short', timeZone: tz }).format(instant);
}

export function exportHeader(store: string, report: ExportReport, p: ResolvedPeriod, tz: string): ExportHeader {
  return { store, title: TITLES[report], period: `${p.label} (${p.from} a ${p.to})`, generatedAt: new Date(), tz };
}

export function exportFileName(report: ExportReport, p: ResolvedPeriod, ext: 'xlsx' | 'pdf'): string {
  return `modaflow-${report}-${p.from}_${p.to}.${ext}`;
}
