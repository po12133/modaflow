"use client";

import Link from "next/link";
import { ImageOff, Minus, Plus, Trash2 } from "lucide-react";
import { CART_MAX_QUANTITY } from "@/config/catalog";
import { lineTotal } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import { useCart } from "./cart-provider";

export function CartLines({ base }: { base: string }) {
  const { lines, setQuantity, remove } = useCart();
  return (
    <ul className="divide-y rounded-2xl border bg-white">
      {lines.map((l) => (
        <li key={l.sku} className="flex gap-3 p-3">
          <Link href={`${base}/producto/${l.productSlug}`} className="shrink-0">
            {l.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
              <img src={l.image} alt="" loading="lazy" className="size-20 rounded-xl bg-muted object-cover" />
            ) : (
              <span className="grid size-20 place-items-center rounded-xl bg-muted text-muted-foreground">
                <ImageOff className="size-5" aria-hidden="true" />
              </span>
            )}
          </Link>
          <div className="grid min-w-0 flex-1 gap-1">
            <Link href={`${base}/producto/${l.productSlug}`} className="line-clamp-2 text-sm font-bold">
              {l.name}
            </Link>
            <span className="text-xs text-muted-foreground">
              {l.variant} · {formatMoney(l.price)} c/u
            </span>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center rounded-xl border" role="group" aria-label={`Cantidad de ${l.name}`}>
                <button type="button" onClick={() => setQuantity(l.sku, l.quantity - 1)} disabled={l.quantity <= 1} className="grid size-9 place-items-center disabled:opacity-40" aria-label="Restar una unidad">
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <span className="w-7 text-center text-sm font-bold">{l.quantity}</span>
                <button type="button" onClick={() => setQuantity(l.sku, l.quantity + 1)} disabled={l.quantity >= Math.min(l.max, CART_MAX_QUANTITY)} className="grid size-9 place-items-center disabled:opacity-40" aria-label="Sumar una unidad">
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
              <b className="text-sm">{formatMoney(lineTotal(l))}</b>
              <button type="button" onClick={() => remove(l.sku)} className="grid size-9 place-items-center text-muted-foreground" aria-label={`Quitar ${l.name}`}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
