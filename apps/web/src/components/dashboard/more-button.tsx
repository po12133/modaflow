"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@modaflow/ui/lib/utils";
import { ACCOUNT_NAV, isActive, MORE_ITEM, navItem } from "./nav-items";

const MORE_ROUTES = [MORE_ITEM.href, navItem("/dashboard/catalogo").href, ...ACCOUNT_NAV.map((i) => i.href)];

export function MoreButton() {
  const pathname = usePathname();
  const active = MORE_ROUTES.some((href) => isActive(pathname, href));
  const Icon = MORE_ITEM.icon;
  return (
    <Link
      href={MORE_ITEM.href}
      aria-label="Más opciones"
      aria-current={active ? "page" : undefined}
      className={cn(
        "grid size-10 place-items-center rounded-xl border bg-white text-ink-2 shadow-sm lg:hidden",
        active && "border-ring text-violet-strong",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </Link>
  );
}
