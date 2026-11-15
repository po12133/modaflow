"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ACCOUNT_NAV, itemActive, MAIN_NAV, type NavItem } from "./nav-items";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = itemActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition-colors",
        active ? "bg-secondary text-violet-strong" : "text-ink-2 hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className={cn("size-[18px]", active ? "text-primary" : "text-[#8f8aa8]")} aria-hidden="true" />
      {item.label}
      {item.soon && (
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[0.62rem] font-bold text-muted-foreground">
          Pronto
        </span>
      )}
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones del panel" className="grid gap-5">
      <div className="grid gap-0.5">
        <p className="px-2.5 pb-1 text-[0.68rem] font-extrabold tracking-widest text-[#a29dbb] uppercase">Principal</p>
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
      <div className="grid gap-0.5">
        <p className="px-2.5 pb-1 text-[0.68rem] font-extrabold tracking-widest text-[#a29dbb] uppercase">Tu cuenta</p>
        {ACCOUNT_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}
