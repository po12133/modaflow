import PDFDocument from 'pdfkit';

export interface ReceiptData {
  number: string;
  status: 'COMPLETED' | 'CANCELED';
  createdAt: Date;
  seller: string;
  store: { name: string; city: string; whatsapp: string; address: string | null; primaryColor: string };
  items: {
    productName: string;
    sku: string;
    size: string | null;
    color: string | null;
    quantity: number;
    unitPrice: string;
    unitDiscount: string;
    finalUnitPrice: string;
    lineTotal: string;
  }[];
  subtotal: string;
  itemsDiscount: string;
  discountType: 'PERCENT' | 'AMOUNT' | null;
  discountValue: string | null;
  discountAmount: string;
  total: string;
  unitCount: number;
  paymentMethod: 'CASH' | 'QR' | 'TRANSFER' | 'OTHER';
  amountReceived: string | null;
  changeGiven: string | null;
  notice: string;
}

export const PAYMENT_LABELS: Record<ReceiptData['paymentMethod'], string> = {
  CASH: 'Efectivo',
  QR: 'QR bancario',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

const WIDTH = 226.77; // 80 mm
const MARGIN = 14;
const INNER = WIDTH - MARGIN * 2;
const INK = '#16132b';
const MUTED = '#6c6889';

const dateFmt = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/La_Paz' });
const timeFmt = new Intl.DateTimeFormat('es-BO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/La_Paz' });

/** "1234.50" -> "Bs 1.234,50" (Bolivian format). */
export function bs(amount: string): string {
  const [int, dec] = Number(amount).toFixed(2).split('.');
  return `Bs ${int!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

/** Draws the receipt and returns the final y position (used to size the page). */
function draw(doc: PDFKit.PDFDocument, r: ReceiptData): number {
  const accent = /^#[0-9a-f]{6}$/i.test(r.store.primaryColor) ? r.store.primaryColor : '#6c4cf5';
  let y = MARGIN;
  const text = (s: string, opts: PDFKit.Mixins.TextOptions & { size?: number; color?: string; bold?: boolean } = {}) => {
    const { size = 8, color = INK, bold = false, ...rest } = opts;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color);
    doc.text(s, MARGIN, y, { width: INNER, ...rest });
    y = doc.y;
  };
  const row = (left: string, right: string, opts: { size?: number; bold?: boolean; color?: string } = {}) => {
    const { size = 8, bold = false, color = INK } = opts;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color);
    const rightWidth = doc.widthOfString(right) + 2;
    const top = y;
    doc.text(left, MARGIN, top, { width: INNER - rightWidth - 6 });
    const leftBottom = doc.y;
    doc.text(right, WIDTH - MARGIN - rightWidth, top, { width: rightWidth, align: 'right' });
    y = Math.max(leftBottom, doc.y);
  };
  const rule = () => {
    y += 4;
    doc.moveTo(MARGIN, y).lineTo(WIDTH - MARGIN, y).dash(2, { space: 2 }).strokeColor('#c9c5d8').lineWidth(0.6).stroke().undash();
    y += 6;
  };

  doc.rect(0, 0, WIDTH, 5).fill(accent);
  y += 2;
  text(r.store.name, { size: 13, bold: true, align: 'center' });
  text([r.store.address, r.store.city].filter(Boolean).join(' · '), { size: 7.5, color: MUTED, align: 'center' });
  text(`WhatsApp ${r.store.whatsapp}`, { size: 7.5, color: MUTED, align: 'center' });
  rule();

  text('COMPROBANTE DE VENTA', { size: 7, bold: true, color: accent, align: 'center', characterSpacing: 0.6 });
  text(r.number, { size: 12, bold: true, align: 'center' });
  if (r.status === 'CANCELED') text('VENTA ANULADA', { size: 10, bold: true, color: '#e0444b', align: 'center' });
  y += 2;
  row('Fecha', `${dateFmt.format(r.createdAt)} ${timeFmt.format(r.createdAt)}`, { size: 7.5 });
  row('Vendedor', r.seller, { size: 7.5 });
  rule();

  for (const item of r.items) {
    text(item.productName, { size: 8.5, bold: true });
    const variant = [item.size, item.color].filter(Boolean).join(' · ');
    if (variant) text(variant, { size: 7, color: MUTED });
    const hasDiscount = Number(item.unitDiscount) > 0;
    row(`${item.quantity} x ${bs(item.unitPrice)}${hasDiscount ? ` - desc. ${bs(item.unitDiscount)}` : ''}`, bs(item.lineTotal), { size: 8 });
    y += 3;
  }
  rule();

  row('Subtotal', bs(r.subtotal));
  if (Number(r.itemsDiscount) > 0) row('Descuentos por prenda', `- ${bs(r.itemsDiscount)}`, { color: MUTED });
  if (Number(r.discountAmount) > 0) {
    const label = r.discountType === 'PERCENT' ? `Descuento general (${Number(r.discountValue)} %)` : 'Descuento general';
    row(label, `- ${bs(r.discountAmount)}`, { color: MUTED });
  }
  y += 2;
  row('TOTAL', bs(r.total), { size: 12, bold: true });
  y += 2;
  row('Pago', PAYMENT_LABELS[r.paymentMethod], { size: 7.5 });
  if (r.amountReceived) row('Recibido', bs(r.amountReceived), { size: 7.5 });
  if (r.changeGiven) row('Cambio', bs(r.changeGiven), { size: 7.5 });
  row('Prendas', String(r.unitCount), { size: 7.5 });
  rule();

  text('¡Gracias por tu compra!', { size: 8.5, bold: true, align: 'center' });
  y += 2;
  text(r.notice, { size: 6.5, color: MUTED, align: 'center' });
  return y + MARGIN;
}

/** Renders the receipt as an 80 mm wide PDF whose height fits its content. */
export async function renderReceiptPdf(receipt: ReceiptData): Promise<Buffer> {
  // First pass on a tall page to measure the content height.
  const probe = new PDFDocument({ size: [WIDTH, 5000], margin: 0 });
  const height = Math.ceil(draw(probe, receipt));
  probe.end();

  const doc = new PDFDocument({
    size: [WIDTH, Math.max(height, 200)],
    margin: 0,
    info: { Title: `Comprobante ${receipt.number}`, Author: receipt.store.name, Creator: 'ModaFlow' },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  draw(doc, receipt);
  doc.end();
  return done;
}
