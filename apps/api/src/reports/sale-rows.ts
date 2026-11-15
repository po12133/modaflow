import type { Prisma } from '../generated/prisma/client.js';
import { formatSaleNumber, fromCents } from '../sales/sale-math.js';
import { decimalToCents } from './report-math.js';

export const SALE_ROW_SELECT = {
  id: true,
  number: true,
  createdAt: true,
  unitCount: true,
  subtotal: true,
  itemsDiscount: true,
  discountAmount: true,
  total: true,
  paymentMethod: true,
  status: true,
  seller: { select: { name: true } },
} as const;

export type SaleRowRecord = Prisma.SaleGetPayload<{ select: typeof SALE_ROW_SELECT }>;

export function toSaleRow(s: SaleRowRecord) {
  const discounts = decimalToCents(s.itemsDiscount.toFixed(2)) + decimalToCents(s.discountAmount.toFixed(2));
  return {
    id: s.id,
    number: formatSaleNumber(s.number),
    createdAt: s.createdAt,
    units: s.unitCount,
    subtotal: s.subtotal.toFixed(2),
    discounts: fromCents(discounts),
    total: s.total.toFixed(2),
    paymentMethod: s.paymentMethod,
    seller: s.seller.name,
    status: s.status,
  };
}

export type SaleReportRow = ReturnType<typeof toSaleRow>;
