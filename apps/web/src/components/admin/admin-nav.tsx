"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "@/config/admin";
import { cn } from "@/lib/utils";

export function AdminNav({ variant, pendingPayments }: { variant: "side" | "top"; pendingPayments: number }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav aria-label="Administración de ModaFlow" className={variant === "side" ? "grid gap-0.5" : "-mx-4 flex gap-1 overflow-x-auto px-4 pb-2"}>
      {ADMIN_NAV.map(([href, label, Icon]) => (
        <Link
          key={href}
          href={href}
          aria-current={active(href) ? "page" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold whitespace-nowrap",
            active(href) ? "bg-secondary text-violet-strong" : "text-ink-2 hover:bg-muted",
          )}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
          {label}
          {href === "/admin/pagos" && pendingPayments > 0 && <span className="ml-auto rounded-full bg-destructive px-1.5 text-xs font-bold text-white">{pendingPayments}</span>}
        </Link>
      ))}
    </nav>
  );
}
