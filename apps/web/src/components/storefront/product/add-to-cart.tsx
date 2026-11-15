"use client";

import Link from "next/link";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { WhatsAppIcon } from "@/components/common/whatsapp-icon";
import { CART_MAX_QUANTITY } from "@/config/catalog";
import { productInquiry, variantText, whatsappLink } from "@/lib/catalog";
import { cn } from "@modaflow/ui/lib/utils";
import type { PublicProductDetail } from "@/types/catalog";
import { useCart } from "../cart/cart-provider";

interface AddToCartProps {
  product: PublicProductDetail;
  storeName: string;
  whatsapp: string;
  productUrl: string;
  cartHref: string;
}

export function AddToCart({ product, storeName, whatsapp, productUrl, cartHref }: AddToCartProps) {
  const { add } = useCart();
  const available = product.variants.filter((v) => v.available > 0);
  const [sku, setSku] = useState(available.length === 1 ? available[0]!.sku : "");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState<string | null>(null);
  const variant = product.variants.find((v) => v.sku === sku);
  const max = Math.min(variant?.available ?? 1, CART_MAX_QUANTITY);
  const single = product.variants.length === 1;

  function addLine() {
    if (!variant) return;
    const ok = add({ productSlug: product.slug, sku: variant.sku, name: product.name, variant: variantText(variant), price: product.price, quantity, max: variant.available, image: product.images[0]?.thumbUrl ?? null });
    setAdded(ok ? `${product.name} agregado al carrito.` : "Tu carrito ya tiene el máximo de prendas distintas.");
  }

  return (
    <div className="grid gap-4">
      {!single && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-bold">Elige talla o color</legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <button
                key={v.sku}
                type="button"
                disabled={v.available === 0}
                aria-pressed={sku === v.sku}
                onClick={() => {
                  setSku(v.sku);
                  setQuantity(1);
                  setAdded(null);
                }}
                className={cn("min-h-11 rounded-xl border px-3.5 text-sm font-bold disabled:line-through disabled:opacity-40", sku === v.sku ? "border-transparent bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white")}
              >
                {variantText(v)}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {product.available && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold">Cantidad</span>
          <div className="flex items-center rounded-xl border bg-white" role="group" aria-label="Cantidad">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} className="grid size-11 place-items-center disabled:opacity-40" aria-label="Restar una unidad">
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span className="w-8 text-center font-bold" aria-live="polite">{quantity}</span>
            <button type="button" onClick={() => setQuantity((q) => Math.min(max, q + 1))} disabled={!variant || quantity >= max} className="grid size-11 place-items-center disabled:opacity-40" aria-label="Sumar una unidad">
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
          {variant && <span className="text-xs text-muted-foreground">{variant.available >= CART_MAX_QUANTITY ? "Disponible" : `Quedan ${variant.available}`}</span>}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={addLine} disabled={!variant || !product.available} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] font-bold text-[var(--brand-ink)] disabled:opacity-50">
          <ShoppingBag className="size-5" aria-hidden="true" /> {product.available ? (variant ? "Agregar al carrito" : "Elige una opción") : "Agotado"}
        </button>
        <a href={whatsappLink(whatsapp, productInquiry(storeName, product.name, productUrl))} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#1fa855] font-bold text-white">
          <WhatsAppIcon /> Consultar por WhatsApp
        </a>
      </div>
      {added && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold">
          <Check className="size-4 text-[#0b7a66]" aria-hidden="true" /> {added}
          <Link href={cartHref} className="ml-auto font-bold underline">
            Ver carrito
          </Link>
        </p>
      )}
    </div>
  );
}
