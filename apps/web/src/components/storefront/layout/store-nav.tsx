"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LayoutGrid, ShoppingBag, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "../cart/cart-provider";

const ITEMS = [
  ["", "Inicio", House],
  ["/categorias", "Categorías", LayoutGrid],
  ["/carrito", "Carrito", ShoppingBag],
  ["/info", "Tienda", Store],
] as const;

export function StoreNav({ base, variant }: { base: string; variant: "top" | "bottom" }) {
  const pathname = usePathname();
  const { units, ready } = useCart();
  const active = (path: string) => (path === "" ? pathname === base || pathname.startsWith(`${base}/producto`) : pathname.startsWith(`${base}${path}`));

  if (variant === "top") {
    return (
      <nav aria-label="Secciones de la tienda" className="ml-6 hidden gap-1 lg:flex">
        {ITEMS.filter(([path]) => path !== "/carrito").map(([path, label]) => (
          <Link key={path} href={`${base}${path}`} aria-current={active(path) ? "page" : undefined} className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", active(path) ? "bg-[var(--brand-soft)] text-foreground" : "text-ink-2")}>
            {label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Navegación de la tienda" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur lg:hidden">
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-4">
        {ITEMS.map(([path, label, Icon]) => (
          <li key={path}>
            <Link
              href={`${base}${path}`}
              aria-current={active(path) ? "page" : undefined}
              className={cn("relative flex h-full flex-col items-center justify-center gap-0.5 text-[0.7rem] font-bold", active(path) ? "text-foreground" : "text-[#8a85a3]")}
            >
              <Icon className="size-[22px]" aria-hidden="true" />
              {label}
              {path === "/carrito" && ready && units > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-2 grid min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1 text-[0.65rem] font-extrabold text-[var(--brand-ink)]">{units}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
