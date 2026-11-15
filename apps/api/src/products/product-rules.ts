import { normalizeKey } from '../common/text.js';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

/** Product-level stock status: 0 = out, 1..threshold = low (threshold 0 disables "low"). */
export function stockStatus(totalStock: number, lowStockThreshold: number): StockStatus {
  if (totalStock <= 0) return 'out_of_stock';
  if (lowStockThreshold > 0 && totalStock <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}

/** Identity of a variant inside its product (size + color, case/accent-insensitive). */
export function variantKey(size: string | null | undefined, color: string | null | undefined): string {
  return `${normalizeKey(size ?? '')}|${normalizeKey(color ?? '')}`;
}

/** Index of the first duplicated (size, color) pair, or -1. */
export function findDuplicateVariant(variants: { size?: string | null; color?: string | null }[]): number {
  const seen = new Set<string>();
  for (let i = 0; i < variants.length; i++) {
    const key = variantKey(variants[i]!.size, variants[i]!.color);
    if (seen.has(key)) return i;
    seen.add(key);
  }
  return -1;
}

/** SKU suffix for a variant: "M" + "Rojo" -> "M-ROJO". Empty for a single unnamed variant. */
export function variantSkuSuffix(size: string | null | undefined, color: string | null | undefined): string {
  return [size, color]
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => normalizeKey(p).replace(/[^a-z0-9]+/g, '').toUpperCase().slice(0, 8))
    .filter(Boolean)
    .join('-');
}

export function formatProductSku(seq: number): string {
  return `P${String(seq).padStart(5, '0')}`;
}

/** "69" / "69.5" -> "69.50" (string money; never floats). */
export function moneyToFixed(value: { toFixed(digits: number): string } | null | undefined): string | null {
  return value == null ? null : value.toFixed(2);
}

export function isPositiveMoney(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value) && Number(value) > 0;
}
