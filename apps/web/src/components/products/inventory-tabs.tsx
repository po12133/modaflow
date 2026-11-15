"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/productos", label: "Productos" },
  { href: "/dashboard/inventario", label: "Stock" },
  { href: "/dashboard/inventario/movimientos", label: "Movimientos" },
];

/** Section switcher shared by products, stock and movement history. */
export function InventoryTabs() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/dashboard/inventario" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav aria-label="Inventario" className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={active(tab.href) ? "page" : undefined}
          className={cn(
            "rounded-lg px-2 py-2 text-center text-sm font-bold",
            active(tab.href) ? "bg-white text-violet-strong shadow-sm" : "text-ink-2",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
