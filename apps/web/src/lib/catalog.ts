import { CART_MAX_QUANTITY } from "@/config/catalog";
import type { CartLine, PublicVariant } from "@/types/catalog";

export function toCents(amount: string): number {
  const [int = "0", frac = ""] = amount.split(".");
  return Number(int) * 100 + Number((frac + "00").slice(0, 2));
}

export function fromCents(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function lineTotal(line: Pick<CartLine, "price" | "quantity">): string {
  return fromCents(toCents(line.price) * line.quantity);
}

export function cartTotals(lines: CartLine[]): { units: number; total: string } {
  return {
    units: lines.reduce((s, l) => s + l.quantity, 0),
    total: fromCents(lines.reduce((s, l) => s + toCents(l.price) * l.quantity, 0)),
  };
}

export function clampQuantity(quantity: number, max: number): number {
  return Math.max(1, Math.min(quantity, max, CART_MAX_QUANTITY));
}

export function addToCart(lines: CartLine[], line: CartLine): CartLine[] {
  const existing = lines.find((l) => l.sku === line.sku && l.productSlug === line.productSlug);
  if (!existing) return [...lines, { ...line, quantity: clampQuantity(line.quantity, line.max) }];
  return lines.map((l) => (l === existing ? { ...l, max: line.max, price: line.price, quantity: clampQuantity(l.quantity + line.quantity, line.max) } : l));
}

export function variantText(v: Pick<PublicVariant, "size" | "color">): string {
  return [v.size ? `Talla ${v.size}` : null, v.color].filter(Boolean).join(" · ") || "Talla única";
}

export function whatsappLink(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export function productInquiry(storeName: string, productName: string, url: string): string {
  return `Hola ${storeName}, me interesa esta prenda: ${productName}. ¿Está disponible?\n${url}`;
}

export function catalogQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function readableText(hex: string): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.4 ? "#16132b" : "#ffffff";
}

export function typedStoreSlug(raw: string): string | null {
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const typed = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  return typed !== value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(typed) ? typed : null;
}
