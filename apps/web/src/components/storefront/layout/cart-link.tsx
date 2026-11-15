"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "../cart/cart-provider";

export function CartLink({ href }: { href: string }) {
  const { units, ready } = useCart();
  return (
    <Link href={href} aria-label={`Carrito${ready && units ? `: ${units} prendas` : ""}`} className="relative hidden size-10 shrink-0 place-items-center rounded-full border bg-white lg:grid">
      <ShoppingBag className="size-5" aria-hidden="true" />
      {ready && units > 0 && (
        <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1 text-[0.68rem] font-extrabold text-[var(--brand-ink)]">{units}</span>
      )}
    </Link>
  );
}
