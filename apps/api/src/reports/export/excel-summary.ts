import type ExcelJS from 'exceljs';
import { PAYMENT_LABELS } from '../../sales/receipt-pdf.js';
import type { ProductStatsService } from '../product-stats.service.js';
import { safeCellText } from '../report-math.js';
import type { SalesStatsService } from '../sales-stats.service.js';
import { ExcelSheet } from './excel-sheet.js';
import { formatChange, MONEY_FMT, toNumber, type ExportHeader } from './export-format.js';

type Summary = Awaited<ReturnType<SalesStatsService['summary']>>;

export interface SummaryExtras {
  chart: Awaited<ReturnType<SalesStatsService['chart']>>;
  methods: Awaited<ReturnType<SalesStatsService['paymentMethods']>>;
  categories: Awaited<ReturnType<SalesStatsService['categories']>>;
  top: Awaited<ReturnType<ProductStatsService['rows']>>;
}

export function writeSummarySheets(wb: ExcelJS.stream.xlsx.WorkbookWriter, h: ExportHeader, summary: Summary, extras?: SummaryExtras) {
  const s = ExcelSheet.create(wb, 'Resumen', h, [30, 18, 18, 22]);
  const k = summary.kpis;
  s.section('Indicadores');
  s.value('Total vendido', toNumber(k.total), true);
  s.value('Cantidad de ventas', k.sales);
  s.value('Prendas vendidas', k.units);
  s.value('Ticket promedio', toNumber(k.averageTicket), true);
  s.value('Descuentos por prenda', toNumber(k.itemsDiscount), true);
  s.value('Descuento general', toNumber(k.generalDiscount), true);
  s.value('Descuentos aplicados', toNumber(k.discounts), true);
  s.value('Ventas anuladas (no incluidas)', k.canceled.sales);
  if (summary.profit) {
    const g = summary.profit;
    s.section(g.complete ? 'Ganancia bruta estimada' : 'Ganancia bruta estimada (parcial)');
    s.value('Ingresos con costo registrado', toNumber(g.knownRevenue), true);
    s.value('Costo de las prendas vendidas', toNumber(g.knownCost), true);
    s.value('Ganancia bruta estimada', toNumber(g.grossProfit), true);
    s.value('Prendas sin costo registrado', g.unitsWithoutCost);
    s.value('Ingresos sin costo registrado', toNumber(g.revenueWithoutCost), true);
    s.note('Estimación: ventas netas menos costo de compra registrado. No incluye gastos, impuestos ni comisiones.');
  }
  if (summary.comparison) {
    const c = summary.comparison;
    const prev = c.previous.kpis;
    s.section(`Comparación con ${c.previous.label}`);
    s.table(['Indicador', 'Actual', 'Anterior', 'Variación'], [null, null, null, null]);
    s.compare('Total vendido', toNumber(k.total), toNumber(prev.total), formatChange(c.changes.total), true);
    s.compare('Cantidad de ventas', k.sales, prev.sales, formatChange(c.changes.sales));
    s.compare('Prendas vendidas', k.units, prev.units, formatChange(c.changes.units));
    s.compare('Ticket promedio', toNumber(k.averageTicket), toNumber(prev.averageTicket), formatChange(c.changes.averageTicket), true);
    s.note(c.rule);
  }
  s.commit();
  if (!extras) return;

  const evo = ExcelSheet.create(wb, 'Evolución', h, [18, 12, 12, 18, 20]);
  evo.table(['Periodo', 'Ventas', 'Prendas', 'Total', 'Periodo anterior'], [null, null, null, MONEY_FMT, MONEY_FMT]);
  for (const pt of extras.chart.points) {
    evo.row([pt.label, pt.sales ?? '', pt.units ?? '', pt.total == null ? '' : toNumber(pt.total), pt.previousTotal == null ? '' : toNumber(pt.previousTotal)]);
  }
  evo.commit();

  const d = ExcelSheet.create(wb, 'Desgloses', h, [30, 14, 18]);
  d.section('Ventas por método de pago');
  d.table(['Método', 'Ventas', 'Total'], [null, null, MONEY_FMT]);
  for (const m of extras.methods.items) d.row([PAYMENT_LABELS[m.method as keyof typeof PAYMENT_LABELS] ?? m.method, m.sales, toNumber(m.total)]);
  d.section('Ventas por categoría');
  d.table(['Categoría', 'Prendas', 'Ingresos'], [null, null, MONEY_FMT]);
  for (const c of extras.categories.items) d.row([safeCellText(c.name), c.units, toNumber(c.revenue)]);
  d.section('Productos más vendidos (top 10)');
  d.table(['Producto', 'Prendas', 'Ingresos'], [null, null, MONEY_FMT]);
  for (const x of extras.top.items) d.row([safeCellText(x.name), x.units, toNumber(x.revenue)]);
  d.commit();
}
