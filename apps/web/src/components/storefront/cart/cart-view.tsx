"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { formatMoney } from "@modaflow/ui/lib/format";
import { CartLines } from "./cart-lines";
import { useCart } from "./cart-provider";
import { WhatsappCheckout } from "./whatsapp-checkout";

export function CartView({ base }: { base: string }) {
  const { lines, units, total, ready } = useCart();
  if (!ready) return <div className="h-40 animate-pulse rounded-2xl bg-muted" aria-busy="true" />;
  if (lines.length === 0) {
    return (
      <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed bg-white p-10 text-center">
        <ShoppingBag className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Tu carrito está vacío.</p>
        <Link href={base} className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-bold text-[var(--brand-ink)]">
          Ver prendas
        </Link>
      </div>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <CartLines base={base} />
      <aside className="grid gap-3 rounded-2xl border bg-white p-4 lg:sticky lg:top-20">
        <dl className="grid gap-1 text-sm">
          <div className="flex justify-between">
            <dt>Prendas</dt>
            <dd>{units}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatMoney(total)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-lg font-extrabold">
            <dt>Total referencial</dt>
            <dd>{formatMoney(total)}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">Agregar al carrito no reserva prendas. La tienda confirma disponibilidad y pago por WhatsApp.</p>
        <WhatsappCheckout />
      </aside>
    </div>
  );
}
