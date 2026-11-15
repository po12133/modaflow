"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CART_MAX_LINES, CART_STORAGE_PREFIX } from "@/config/catalog";
import { addToCart, cartTotals, clampQuantity } from "@/lib/catalog";
import type { CartLine } from "@/types/catalog";

interface CartContextValue {
  slug: string;
  lines: CartLine[];
  ready: boolean;
  units: number;
  total: string;
  add: (line: CartLine) => boolean;
  setQuantity: (sku: string, quantity: number) => void;
  setMax: (sku: string, max: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function read(key: string): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? (parsed as CartLine[]).filter((l) => l && typeof l.sku === "string" && l.quantity > 0) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const key = `${CART_STORAGE_PREFIX}${slug}`;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists after hydration
    setLines(read(key));
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(lines));
    } catch {
      return;
    }
  }, [key, lines, ready]);

  const add = useCallback(
    (line: CartLine) => {
      if (lines.length >= CART_MAX_LINES && !lines.some((l) => l.sku === line.sku)) return false;
      setLines((current) => addToCart(current, line));
      return true;
    },
    [lines],
  );

  const value = useMemo<CartContextValue>(() => {
    const totals = cartTotals(lines);
    return {
      slug,
      lines,
      ready,
      ...totals,
      add,
      setQuantity: (sku, quantity) => setLines((c) => c.map((l) => (l.sku === sku ? { ...l, quantity: clampQuantity(quantity, l.max) } : l))),
      setMax: (sku, max) => setLines((c) => c.flatMap((l) => (l.sku !== sku ? [l] : max <= 0 ? [] : [{ ...l, max, quantity: clampQuantity(l.quantity, max) }]))),
      remove: (sku) => setLines((c) => c.filter((l) => l.sku !== sku)),
      clear: () => setLines([]),
    };
  }, [slug, lines, ready, add]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
