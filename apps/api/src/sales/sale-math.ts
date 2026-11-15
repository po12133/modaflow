/**
 * Sale amount calculation in integer centavos (no floating point).
 *
 * Order (always the same):
 *   1. line subtotal  = unit price x quantity
 *   2. item discount  = per-unit discount (percent of the unit price, or Bs per unit) x quantity
 *   3. subtotal after item discounts
 *   4. general discount on that amount (percent or Bs)
 *   5. total
 * Percentages accept up to 2 decimals (12.5%) and round half-up to the centavo.
 */

export type DiscountKind = 'PERCENT' | 'AMOUNT';

export interface DiscountInput {
  type: DiscountKind;
  /** Decimal string: "10" (Bs or %), "12.5". */
  value: string;
}

export interface LineInput {
  unitPriceCents: number;
  quantity: number;
  discount?: DiscountInput | null;
}

export interface LineResult {
  unitPriceCents: number;
  quantity: number;
  unitDiscountCents: number;
  finalUnitPriceCents: number;
  lineSubtotalCents: number;
  lineDiscountCents: number;
  lineTotalCents: number;
}

export interface SaleTotals {
  lines: LineResult[];
  subtotalCents: number;
  itemsDiscountCents: number;
  afterItemsCents: number;
  discountCents: number;
  totalCents: number;
  units: number;
}

/** Raised for invalid amounts; `field` follows the request shape (e.g. "items.0.discount"). */
export class SaleRuleError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

const MONEY = /^\d{1,9}(\.\d{1,2})?$/;

/** "69.5" -> 6950. Throws for negatives, more than 2 decimals or garbage. */
export function toCents(value: string, field = 'amount'): number {
  const v = value.trim().replace(',', '.');
  if (!MONEY.test(v)) throw new SaleRuleError(field, 'Ingresa un monto válido, por ejemplo 10 o 10.50.');
  const [int, dec = ''] = v.split('.');
  return Number(int) * 100 + Number(dec.padEnd(2, '0'));
}

/** 6950 -> "69.50" */
export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Percent with up to 2 decimals as basis points: "12.5" -> 1250. Must be 0..100. */
function toBasisPoints(value: string, field: string): number {
  const bp = toCents(value, field);
  if (bp > 10_000) throw new SaleRuleError(field, 'El descuento no puede superar el 100 %.');
  return bp;
}

/** Discount amount for a base, never above the base. */
export function discountAmount(baseCents: number, discount: DiscountInput | null | undefined, field: string): number {
  if (!discount) return 0;
  if (discount.type === 'PERCENT') {
    return Math.round((baseCents * toBasisPoints(discount.value, field)) / 10_000);
  }
  const amount = toCents(discount.value, field);
  if (amount > baseCents) {
    throw new SaleRuleError(field, 'El descuento no puede ser mayor al importe.');
  }
  return amount;
}

export function computeSale(lines: LineInput[], general?: DiscountInput | null): SaleTotals {
  const results: LineResult[] = lines.map((line, i) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new SaleRuleError(`items.${i}.quantity`, 'La cantidad debe ser al menos 1.');
    }
    // Item discounts apply per unit, so the final unit price is exact.
    const unitDiscountCents = discountAmount(line.unitPriceCents, line.discount, `items.${i}.discount`);
    const finalUnitPriceCents = line.unitPriceCents - unitDiscountCents;
    return {
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      unitDiscountCents,
      finalUnitPriceCents,
      lineSubtotalCents: line.unitPriceCents * line.quantity,
      lineDiscountCents: unitDiscountCents * line.quantity,
      lineTotalCents: finalUnitPriceCents * line.quantity,
    };
  });
  const subtotalCents = results.reduce((s, l) => s + l.lineSubtotalCents, 0);
  const itemsDiscountCents = results.reduce((s, l) => s + l.lineDiscountCents, 0);
  const afterItemsCents = subtotalCents - itemsDiscountCents;
  const discountCents = discountAmount(afterItemsCents, general, 'discount');
  return {
    lines: results,
    subtotalCents,
    itemsDiscountCents,
    afterItemsCents,
    discountCents,
    totalCents: afterItemsCents - discountCents,
    units: results.reduce((s, l) => s + l.quantity, 0),
  };
}

export function allocateGeneralDiscount(lineTotalsCents: number[], discountCents: number): number[] {
  const linesTotal = lineTotalsCents.reduce((s, c) => s + c, 0);
  if (discountCents <= 0 || linesTotal === 0) return [...lineTotalsCents];
  const shares = lineTotalsCents.map((c) => Math.floor((discountCents * c) / linesTotal));
  let leftover = discountCents - shares.reduce((s, c) => s + c, 0);
  for (let i = 0; i < shares.length && leftover > 0; i++, leftover--) shares[i]! += 1;
  return lineTotalsCents.map((c, i) => c - shares[i]!);
}

/** Change for cash payments. Received must cover the total. */
export function cashChange(totalCents: number, received: string | null | undefined): { receivedCents: number; changeCents: number } | null {
  if (received == null || received === '') return null;
  const receivedCents = toCents(received, 'amountReceived');
  if (receivedCents < totalCents) {
    throw new SaleRuleError('amountReceived', 'El monto recibido es menor al total.');
  }
  return { receivedCents, changeCents: receivedCents - totalCents };
}

export function formatSaleNumber(n: number): string {
  return `V-${String(n).padStart(6, '0')}`;
}

/** Accepts "V-000012", "v12", "12" -> 12. */
export function parseSaleNumber(input: string): number | null {
  const digits = input.trim().replace(/^v-?/i, '');
  return /^\d{1,9}$/.test(digits) ? Number(digits) : null;
}
