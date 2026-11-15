import type ExcelJS from 'exceljs';
import { safeCellText } from '../report-math.js';
import { BRAND, localDateTimeText, MONEY_FMT, type ExportHeader } from './export-format.js';

export type Cell = string | number | Date;

export class ExcelSheet {
  private formats: (string | null)[] = [];

  constructor(private readonly ws: ExcelJS.Worksheet) {}

  static create(wb: ExcelJS.stream.xlsx.WorkbookWriter, name: string, h: ExportHeader, widths: number[]): ExcelSheet {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 4 }] });
    ws.columns = widths.map((width) => ({ width }));
    const title = ws.addRow([`${safeCellText(h.store)} · ${h.title}`]);
    title.font = { bold: true, size: 14, color: { argb: `FF${BRAND}` } };
    title.commit();
    ws.addRow([`Periodo: ${h.period}`]).commit();
    ws.addRow([`Generado: ${localDateTimeText(h.generatedAt, h.tz)} (${h.tz})`]).commit();
    ws.addRow([]).commit();
    return new ExcelSheet(ws);
  }

  section(title: string) {
    this.ws.addRow([]).commit();
    const r = this.ws.addRow([title]);
    r.font = { bold: true, size: 12 };
    r.commit();
  }

  note(text: string) {
    const r = this.ws.addRow([text]);
    r.font = { italic: true, color: { argb: 'FF6C6889' } };
    r.commit();
  }

  value(label: string, value: number, money = false) {
    const r = this.ws.addRow([label, value]);
    if (money) r.getCell(2).numFmt = MONEY_FMT;
    r.commit();
  }

  compare(label: string, current: number, previous: number, change: string, money = false) {
    const r = this.ws.addRow([label, current, previous, change]);
    if (money) {
      r.getCell(2).numFmt = MONEY_FMT;
      r.getCell(3).numFmt = MONEY_FMT;
    }
    r.commit();
  }

  table(headers: string[], formats: (string | null)[], filter = false) {
    const r = this.ws.addRow(headers);
    r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    r.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND}` } };
    });
    this.formats = formats;
    if (filter) this.ws.autoFilter = { from: { row: r.number, column: 1 }, to: { row: r.number, column: headers.length } };
    r.commit();
  }

  row(values: Cell[], bold = false) {
    const r = this.ws.addRow(values);
    this.formats.forEach((fmt, i) => {
      if (fmt && typeof values[i] !== 'string') r.getCell(i + 1).numFmt = fmt;
    });
    if (bold) r.font = { bold: true };
    r.commit();
  }

  commit() {
    this.ws.commit();
  }
}
