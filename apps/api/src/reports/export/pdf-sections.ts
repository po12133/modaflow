import { bs } from '../../sales/receipt-pdf.js';
import type { InventoryStatsService } from '../inventory-stats.service.js';
import type { SalesStatsService } from '../sales-stats.service.js';
import { formatChange, MOVEMENT_LABELS } from './export-format.js';
import type { PdfWriter } from './pdf-writer.js';

type Summary = Awaited<ReturnType<SalesStatsService['summary']>>;
type Inventory = Awaited<ReturnType<InventoryStatsService['build']>>;
type Card = [string, string, string?];

export function summaryCards(summary: Summary): Card[] {
  const { kpis: k, comparison: c, profit } = summary;
  const vs = (v: number | null) => (c ? `vs. anterior: ${formatChange(v)}` : undefined);
  return [
    ['Total vendido', bs(k.total), vs(c?.changes.total ?? null)],
    ['Ventas', String(k.sales), vs(c?.changes.sales ?? null)],
    ['Prendas vendidas', String(k.units), vs(c?.changes.units ?? null)],
    ['Ticket promedio', bs(k.averageTicket), vs(c?.changes.averageTicket ?? null)],
    ['Descuentos aplicados', bs(k.discounts)],
    profit
      ? [
          profit.complete ? 'Ganancia bruta estimada' : 'Ganancia estimada (parcial)',
          bs(profit.grossProfit),
          profit.complete ? 'Ventas netas - costo de compra' : `${profit.unitsWithoutCost} prendas sin costo registrado`,
        ]
      : ['Ventas anuladas', String(k.canceled.sales), 'No se incluyen en los totales'],
  ];
}

export function writeInventoryPdf(pdf: PdfWriter, inv: Inventory) {
  const cards: Card[] = [
    ['Productos activos', String(inv.stock.activeProducts)],
    ['Unidades disponibles', String(inv.stock.units)],
    ['Agotados', String(inv.stock.outOfStock)],
    ['Stock bajo', String(inv.lowStock.total)],
  ];
  if (inv.value) {
    cards.push([inv.value.complete ? 'Valor (costo)' : 'Valor (costo, parcial)', bs(inv.value.costValue), inv.value.complete ? undefined : `${inv.value.unitsWithoutCost} u. sin costo`]);
    cards.push(['Valor a precio de venta', bs(inv.value.retailValue)]);
  }
  pdf.cards(cards);
  if (inv.movements) {
    pdf.table(
      'Movimientos del periodo',
      [
        { title: 'Tipo', width: 255 },
        { title: 'Movimientos', width: 80, align: 'right' },
        { title: 'Unidades', width: 80, align: 'right' },
      ],
      inv.movements.map((m) => [MOVEMENT_LABELS[m.type], String(m.movements), String(m.units)]),
    );
  }
  pdf.table(
    'Productos con stock bajo',
    [
      { title: 'Producto', width: 200 },
      { title: 'SKU', width: 90 },
      { title: 'Categoría', width: 105 },
      { title: 'Stock', width: 50, align: 'right' },
      { title: 'Umbral', width: 50, align: 'right' },
    ],
    inv.lowStock.items.map((x) => [x.name, x.sku, x.category ?? '-', String(x.stock), String(x.threshold)]),
  );
}
