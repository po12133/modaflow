import { bs } from '../../sales/receipt-pdf.js';
import { BRAND, type ExportHeader } from './export-format.js';

export interface Column {
  title: string;
  width: number;
  align?: 'left' | 'right';
}

const INK = '#16132b';
const MUTED = '#6c6889';
const LINE = '#e6e3f2';

export class PdfWriter {
  private readonly left = 40;
  private readonly width: number;
  private readonly bottom: number;

  constructor(
    private readonly doc: PDFKit.PDFDocument,
    private readonly h: ExportHeader,
  ) {
    this.width = doc.page.width - 80;
    this.bottom = doc.page.height - 50;
  }

  header() {
    const d = this.doc;
    d.rect(0, 0, d.page.width, 6).fill(`#${BRAND}`);
    d.fillColor(INK).font('Helvetica-Bold').fontSize(16).text(this.h.store, this.left, 28, { width: this.width });
    d.fillColor(`#${BRAND}`).fontSize(12).text(this.h.title);
    d.fillColor(MUTED).font('Helvetica').fontSize(9).text(`Periodo: ${this.h.period}`);
    d.text(`Generado: ${new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short', timeZone: this.h.tz }).format(this.h.generatedAt)} (${this.h.tz})`);
    d.moveDown(0.8);
  }

  private ensure(height: number) {
    if (this.doc.y + height > this.bottom) {
      this.doc.addPage();
      this.doc.y = 40;
    }
  }

  cards(cards: [string, string, string?][]) {
    const d = this.doc;
    const cols = 3;
    const gap = 8;
    const w = (this.width - gap * (cols - 1)) / cols;
    const hgt = 52;
    for (let i = 0; i < cards.length; i += cols) {
      this.ensure(hgt + gap);
      const y = d.y;
      cards.slice(i, i + cols).forEach(([label, value, sub], j) => {
        const x = this.left + j * (w + gap);
        d.roundedRect(x, y, w, hgt, 6).fillAndStroke('#f6f5fb', LINE);
        d.fillColor(MUTED).font('Helvetica').fontSize(8).text(label, x + 8, y + 7, { width: w - 16 });
        d.fillColor(INK).font('Helvetica-Bold').fontSize(13).text(value, x + 8, y + 19, { width: w - 16 });
        if (sub) d.fillColor(MUTED).font('Helvetica').fontSize(7).text(sub, x + 8, y + 37, { width: w - 16 });
      });
      d.y = y + hgt + gap;
    }
    d.x = this.left;
  }

  note(text: string) {
    this.ensure(24);
    this.doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(8).text(text, this.left, this.doc.y, { width: this.width });
    this.doc.moveDown(0.6);
  }

  private title(text: string) {
    this.ensure(40);
    this.doc.moveDown(0.4);
    this.doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(text, this.left, this.doc.y, { width: this.width });
    this.doc.moveDown(0.3);
  }

  barChart(title: string, points: { label: string; value: number | null }[]) {
    this.title(title);
    const d = this.doc;
    const height = 120;
    this.ensure(height + 30);
    const top = d.y;
    const max = Math.max(0, ...points.map((p) => p.value ?? 0));
    if (max === 0) {
      d.fillColor(MUTED).font('Helvetica').fontSize(9).text('Sin ventas en este periodo.', this.left, top);
      d.moveDown();
      return;
    }
    const slot = this.width / points.length;
    const barW = Math.max(1, Math.min(24, slot * 0.7));
    d.moveTo(this.left, top + height).lineTo(this.left + this.width, top + height).strokeColor(LINE).stroke();
    const every = Math.ceil(points.length / 12);
    points.forEach((p, i) => {
      const x = this.left + i * slot + (slot - barW) / 2;
      if (p.value) {
        const bh = (p.value / max) * (height - 12);
        d.rect(x, top + height - bh, barW, bh).fill(`#${BRAND}`);
      }
      if (i % every === 0) {
        d.fillColor(MUTED).font('Helvetica').fontSize(6.5).text(p.label, this.left + i * slot - 10, top + height + 4, { width: slot + 20, align: 'center' });
      }
    });
    d.fillColor(MUTED).fontSize(7).text(`Máximo: ${bs(max.toFixed(2))}`, this.left, top - 2, { width: this.width, align: 'right' });
    d.y = top + height + 20;
    d.x = this.left;
  }

  table(title: string, columns: Column[], rows: string[][], footer?: string[], fontSize = 8) {
    this.title(title);
    const d = this.doc;
    const rowH = fontSize + 7;
    const drawHead = () => {
      this.ensure(rowH * 2);
      const y = d.y;
      d.rect(this.left, y, this.width, rowH).fill(`#${BRAND}`);
      let x = this.left;
      for (const c of columns) {
        d.fillColor('#ffffff').font('Helvetica-Bold').fontSize(fontSize).text(c.title, x + 3, y + 3.5, { width: c.width - 6, align: c.align ?? 'left', lineBreak: false, ellipsis: true });
        x += c.width;
      }
      d.y = y + rowH;
    };
    if (rows.length === 0) {
      d.fillColor(MUTED).font('Helvetica').fontSize(9).text('Sin datos en este periodo.', this.left, d.y);
      d.moveDown();
      return;
    }
    drawHead();
    const drawRow = (cells: string[], i: number, bold = false) => {
      if (d.y + rowH > this.bottom) {
        d.addPage();
        d.y = 40;
        drawHead();
      }
      const y = d.y;
      if (i % 2 === 1) d.rect(this.left, y, this.width, rowH).fill('#f6f5fb');
      let x = this.left;
      columns.forEach((c, j) => {
        d.fillColor(INK).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).text(cells[j] ?? '', x + 3, y + 3.5, {
          width: c.width - 6,
          align: c.align ?? 'left',
          lineBreak: false,
          ellipsis: true,
        });
        x += c.width;
      });
      d.y = y + rowH;
    };
    rows.forEach((r, i) => drawRow(r, i));
    if (footer) drawRow(footer, 0, true);
    d.x = this.left;
    d.moveDown(0.5);
  }

  finish() {
    const d = this.doc;
    const range = d.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      d.switchToPage(i);
      d.page.margins.bottom = 0;
      d.fillColor(MUTED).font('Helvetica').fontSize(7.5);
      d.text(`ModaFlow · ${this.h.store} · ${this.h.title}`, this.left, d.page.height - 32, { width: this.width / 2, lineBreak: false });
      d.text(`Página ${i + 1} de ${range.count}`, this.left + this.width / 2, d.page.height - 32, { width: this.width / 2, align: 'right', lineBreak: false });
    }
  }
}
