"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@modaflow/ui/lib/utils";
import { isActive, itemActive, navItem, REGISTER_ITEM, type NavItem } from "./nav-items";

function tabActive(pathname: string, item: NavItem): boolean {
  if (item === REGISTER_ITEM) return isActive(pathname, item.href);
  if (item.href === "/dashboard/productos") return itemActive(pathname, item) && !isActive(pathname, REGISTER_ITEM.href);
  if (item.href === "/dashboard/ventas/nueva") return itemActive(pathname, item) || itemActive(pathname, navItem("/dashboard/ventas"));
  return itemActive(pathname, item);
}

export function BottomNav() {
  const pathname = usePathname();
  const items = [navItem("/dashboard"), navItem("/dashboard/productos"), REGISTER_ITEM, navItem("/dashboard/ventas/nueva"), navItem("/dashboard/reportes")];

  return (
    <nav
      aria-label="Navegación principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 shadow-[0_-6px_20px_-14px_rgba(22,19,43,0.3)] backdrop-blur lg:hidden print:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5 items-end px-1">
        {items.map((item) => {
          const active = tabActive(pathname, item);
          const Icon = item.icon;
          const isMain = item === REGISTER_ITEM;
          return (
            <li key={item.href} className="h-full">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[0.7rem] font-bold",
                  active ? "text-violet-strong" : "text-[#8a85a3]",
                )}
              >
                {isMain ? (
                  <span className="-mt-7 mb-0.5 grid size-14 place-items-center rounded-full border-4 border-white bg-brand-gradient text-white shadow-[0_10px_22px_-8px_rgba(176,76,240,0.8)]">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                ) : (
                  <Icon className="size-[22px]" aria-hidden="true" />
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
