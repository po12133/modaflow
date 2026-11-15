import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { bs, PAYMENT_LABELS } from '../../sales/receipt-pdf.js';
import type { ExportQueryDto } from '../dto.js';
import { InventoryStatsService } from '../inventory-stats.service.js';
import { ProductStatsService } from '../product-stats.service.js';
import type { ReportContext } from '../report-context.service.js';
import type { ResolvedPeriod } from '../report-period.types.js';
import { SalesStatsService } from '../sales-stats.service.js';
import { SalesTableService } from '../sales-table.service.js';
import { exportFileName, exportHeader, localDateTimeText, PDF_MAX_ROWS, PRODUCT_BATCH, STATUS_LABELS, toNumber } from './export-format.js';
import { summaryCards, writeInventoryPdf } from './pdf-sections.js';
import { PdfWriter } from './pdf-writer.js';

@Injectable()
export class PdfExportService {
  constructor(
    private readonly stats: SalesStatsService,
    private readonly table: SalesTableService,
    private readonly products: ProductStatsService,
    private readonly inventory: InventoryStatsService,
  ) {}

  async write(ctx: ReportContext, p: ResolvedPeriod, q: ExportQueryDto, res: Response): Promise<void> {
    const report = q.report ?? 'summary';
    const h = exportHeader(ctx.storeName, report, p, ctx.tz);
    const summary = await this.stats.summary(ctx, p);
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: `${h.title} - ${h.store}`, Author: 'ModaFlow' } });
    const pdf = new PdfWriter(doc, h);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileName(report, p, 'pdf')}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    doc.pipe(res);
    pdf.header();
    pdf.cards(summaryCards(summary));
    if (summary.comparison) pdf.note(`Comparación con ${summary.comparison.previous.label}. ${summary.comparison.rule}`);
    if (summary.profit) pdf.note('La ganancia bruta es una estimación: no incluye gastos operativos, impuestos ni comisiones.');

    if (report === 'summary') await this.summary(pdf, ctx, p);
    else if (report === 'sales') await this.sales(pdf, ctx, p, q, summary.kpis);
    else if (report === 'products') await this.productList(pdf, ctx, p, q);
    else writeInventoryPdf(pdf, await this.inventory.build(ctx, p, q, PDF_MAX_ROWS));

    pdf.finish();
    doc.end();
    await new Promise<void>((resolve, reject) => {
      res.on('finish', resolve);
      res.on('error', reject);
    });
  }

  private async summary(pdf: PdfWriter, ctx: ReportContext, p: ResolvedPeriod) {
    const [chart, methods, categories, top] = await Promise.all([
      this.stats.chart(ctx, p),
      this.stats.paymentMethods(ctx, p),
      this.stats.categories(ctx, p),
      this.products.rows(ctx, p, { sort: 'units_desc' }, 10, 0, false),
    ]);
    const cols = (first: string, second: string, third: string) => [
      { title: first, width: 255 },
      { title: second, width: 70, align: 'right' as const },
      { title: third, width: 90, align: 'right' as const },
    ];
    pdf.barChart('Evolución de ventas', chart.points.map((pt) => ({ label: pt.label, value: pt.total == null ? null : toNumber(pt.total) })));
    pdf.table('Productos más vendidos', cols('Producto', 'Prendas', 'Ingresos'), top.items.map((x) => [x.name, String(x.units), bs(x.revenue)]));
    pdf.table('Ventas por categoría', cols('Categoría', 'Prendas', 'Ingresos'), categories.items.map((c) => [c.name, String(c.units), bs(c.revenue)]));
    pdf.table(
      'Métodos de pago',
      cols('Método', 'Ventas', 'Total'),
      methods.items.map((m) => [PAYMENT_LABELS[m.method as keyof typeof PAYMENT_LABELS] ?? m.method, String(m.sales), bs(m.total)]),
    );
  }

  private async sales(pdf: PdfWriter, ctx: ReportContext, p: ResolvedPeriod, q: ExportQueryDto, k: Awaited<ReturnType<SalesStatsService['kpis']>>) {
    const rows: string[][] = [];
    let truncated = false;
    for await (const batch of this.table.batches(ctx, p, q)) {
      for (const r of batch) {
        if (rows.length >= PDF_MAX_ROWS) {
          truncated = true;
          break;
        }
        rows.push([localDateTimeText(r.createdAt, ctx.tz), r.number, String(r.units), bs(r.subtotal), bs(r.discounts), bs(r.total), PAYMENT_LABELS[r.paymentMethod], r.seller, STATUS_LABELS[r.status]]);
      }
      if (truncated) break;
    }
    pdf.table(
      'Ventas',
      [
        { title: 'Fecha', width: 62 },
        { title: 'N.º', width: 50 },
        { title: 'Prendas', width: 36, align: 'right' },
        { title: 'Subtotal', width: 58, align: 'right' },
        { title: 'Desc.', width: 50, align: 'right' },
        { title: 'Total', width: 58, align: 'right' },
        { title: 'Pago', width: 56 },
        { title: 'Vendedor', width: 75 },
        { title: 'Estado', width: 50 },
      ],
      rows,
      ['Total (sin anuladas)', '', String(k.units), bs(k.subtotal), bs(k.discounts), bs(k.total), '', '', ''],
      7,
    );
    if (truncated) pdf.note(`El PDF muestra las primeras ${PDF_MAX_ROWS} ventas. Descarga el Excel para el detalle completo.`);
  }

  private async productList(pdf: PdfWriter, ctx: ReportContext, p: ResolvedPeriod, q: ExportQueryDto) {
    const rows: string[][] = [];
    for (let offset = 0; offset < PDF_MAX_ROWS; offset += PRODUCT_BATCH) {
      const { items } = await this.products.rows(ctx, p, q, PRODUCT_BATCH, offset, false);
      for (const x of items) {
        const noCost = x.profit.knownRevenue === '0.00' && !x.profit.complete;
        rows.push([x.name, x.category ?? '-', String(x.units), bs(x.revenue), noCost ? 'Sin costo' : `${bs(x.profit.grossProfit)}${x.profit.complete ? '' : ' *'}`]);
      }
      if (items.length < PRODUCT_BATCH) break;
    }
    pdf.table(
      'Productos vendidos',
      [
        { title: 'Producto', width: 185 },
        { title: 'Categoría', width: 95 },
        { title: 'Prendas', width: 55, align: 'right' },
        { title: 'Ingresos', width: 85, align: 'right' },
        { title: 'Ganancia est.', width: 95, align: 'right' },
      ],
      rows,
    );
    pdf.note('* Ganancia parcial: hay prendas vendidas sin costo de compra registrado.');
    if (rows.length >= PDF_MAX_ROWS) pdf.note(`El PDF muestra los primeros ${PDF_MAX_ROWS} productos. Descarga el Excel para el detalle completo.`);
  }
}

