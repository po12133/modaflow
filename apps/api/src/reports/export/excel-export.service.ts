import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { tzOffsetMs } from '../../common/zoned-time.js';
import { PAYMENT_LABELS } from '../../sales/receipt-pdf.js';
import type { ExportQueryDto } from '../dto.js';
import { InventoryStatsService } from '../inventory-stats.service.js';
import { ProductStatsService } from '../product-stats.service.js';
import type { ReportContext } from '../report-context.service.js';
import { decimalToCents, safeCellText } from '../report-math.js';
import type { ResolvedPeriod } from '../report-period.types.js';
import { SalesStatsService } from '../sales-stats.service.js';
import { SalesTableService } from '../sales-table.service.js';
import { ExcelSheet } from './excel-sheet.js';
import { exportFileName, exportHeader, MONEY_FMT, MOVEMENT_LABELS, PRODUCT_BATCH, STATUS_LABELS, toNumber, type ExportHeader } from './export-format.js';
import { writeSummarySheets } from './excel-summary.js';

type Writer = ExcelJS.stream.xlsx.WorkbookWriter;

@Injectable()
export class ExcelExportService {
  constructor(
    private readonly stats: SalesStatsService,
    private readonly table: SalesTableService,
    private readonly products: ProductStatsService,
    private readonly inventory: InventoryStatsService,
  ) {}

  async write(ctx: ReportContext, p: ResolvedPeriod, q: ExportQueryDto, res: Response): Promise<void> {
    const report = q.report ?? 'summary';
    const summary = await this.stats.summary(ctx, p);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileName(report, p, 'xlsx')}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true, useSharedStrings: false });
    wb.creator = 'ModaFlow';
    const h = exportHeader(ctx.storeName, report, p, ctx.tz);

    if (report === 'summary') {
      const [chart, methods, categories, top] = await Promise.all([
        this.stats.chart(ctx, p),
        this.stats.paymentMethods(ctx, p),
        this.stats.categories(ctx, p),
        this.products.rows(ctx, p, { sort: 'units_desc' }, 10, 0, false),
      ]);
      writeSummarySheets(wb, h, summary, { chart, methods, categories, top });
    } else {
      writeSummarySheets(wb, h, summary);
      if (report === 'sales') await this.salesSheet(wb, h, ctx, p, q);
      else if (report === 'products') await this.productsSheet(wb, h, ctx, p, q);
      else await this.inventorySheet(wb, h, ctx, p, q);
    }
    await wb.commit();
  }

  private async salesSheet(wb: Writer, h: ExportHeader, ctx: ReportContext, p: ResolvedPeriod, q: ExportQueryDto) {
    const s = ExcelSheet.create(wb, 'Ventas', h, [18, 12, 10, 14, 14, 14, 16, 24, 13]);
    s.table(
      ['Fecha', 'N.º de venta', 'Prendas', 'Subtotal', 'Descuentos', 'Total', 'Método de pago', 'Vendedor', 'Estado'],
      ['dd/mm/yyyy hh:mm', null, null, MONEY_FMT, MONEY_FMT, MONEY_FMT, null, null, null],
      true,
    );
    const sum = { units: 0, subtotal: 0, discounts: 0, total: 0 };
    for await (const batch of this.table.batches(ctx, p, q)) {
      for (const r of batch) {
        s.row([
          new Date(r.createdAt.getTime() + tzOffsetMs(r.createdAt, ctx.tz)),
          r.number,
          r.units,
          toNumber(r.subtotal),
          toNumber(r.discounts),
          toNumber(r.total),
          PAYMENT_LABELS[r.paymentMethod],
          safeCellText(r.seller),
          STATUS_LABELS[r.status],
        ]);
        if (r.status !== 'COMPLETED') continue;
        sum.units += r.units;
        sum.subtotal += decimalToCents(r.subtotal);
        sum.discounts += decimalToCents(r.discounts);
        sum.total += decimalToCents(r.total);
      }
    }
    s.row(['Total (sin anuladas)', '', sum.units, sum.subtotal / 100, sum.discounts / 100, sum.total / 100, '', '', ''], true);
    s.commit();
  }

  private async productsSheet(wb: Writer, h: ExportHeader, ctx: ReportContext, p: ResolvedPeriod, q: ExportQueryDto) {
    const s = ExcelSheet.create(wb, 'Productos', h, [36, 16, 20, 10, 10, 16, 18, 14]);
    s.table(['Producto', 'SKU', 'Categoría', 'Prendas', 'Ventas', 'Ingresos', 'Ganancia estimada', 'Sin costo (u.)'], [null, null, null, null, null, MONEY_FMT, MONEY_FMT, null], true);
    for (let offset = 0; ; offset += PRODUCT_BATCH) {
      const { items } = await this.products.rows(ctx, p, q, PRODUCT_BATCH, offset, false);
      for (const x of items) {
        const hasCost = x.profit.complete || x.profit.knownRevenue !== '0.00';
        s.row([safeCellText(x.name), safeCellText(x.sku), safeCellText(x.category), x.units, x.sales, toNumber(x.revenue), hasCost ? toNumber(x.profit.grossProfit) : '', x.profit.unitsWithoutCost]);
      }
      if (items.length < PRODUCT_BATCH) break;
    }
    s.note('Ingresos netos (después de descuentos). La ganancia es parcial cuando hay prendas sin costo registrado.');
    s.commit();
  }

  private async inventorySheet(wb: Writer, h: ExportHeader, ctx: ReportContext, p: ResolvedPeriod, q: ExportQueryDto) {
    const inv = await this.inventory.build(ctx, p, q, 5000);
    const s = ExcelSheet.create(wb, 'Inventario', h, [36, 16, 20, 12, 12]);
    s.section('Stock actual');
    s.value('Productos activos', inv.stock.activeProducts);
    s.value('Unidades disponibles', inv.stock.units);
    s.value('Productos agotados', inv.stock.outOfStock);
    s.value('Productos con stock bajo', inv.lowStock.total);
    if (inv.value) {
      s.value(inv.value.complete ? 'Valor del inventario (costo)' : 'Valor del inventario (costo, parcial)', toNumber(inv.value.costValue), true);
      s.value('Valor a precio de venta', toNumber(inv.value.retailValue), true);
      s.value('Unidades sin costo registrado', inv.value.unitsWithoutCost);
    }
    if (inv.movements) {
      s.section('Movimientos del periodo');
      s.table(['Tipo', 'Movimientos', 'Unidades'], [null, null, null]);
      for (const m of inv.movements) s.row([MOVEMENT_LABELS[m.type], m.movements, m.units]);
    }
    s.section('Productos con stock bajo');
    s.table(['Producto', 'SKU', 'Categoría', 'Stock', 'Umbral'], [null, null, null, null, null]);
    for (const x of inv.lowStock.items) s.row([safeCellText(x.name), safeCellText(x.sku), safeCellText(x.category), x.stock, x.threshold]);
    s.commit();
  }
}
