import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LogoutButton, PageHeader } from "@/components/dashboard/common";
import { ACCOUNT_NAV, navItem } from "@/components/dashboard/nav-items";

export const metadata: Metadata = { title: "Más" };

// Per-request page (reads the session through the API).
export const instant = false;

/** Mobile "Más" tab: account sections that don't fit in the bottom bar. */
export default function MorePage() {
  return (
    <>
      <PageHeader title="Más opciones" />
      <nav aria-label="Más opciones" className="grid gap-2">
        {[{ ...navItem("/dashboard/ventas"), label: "Historial de ventas" }, ...ACCOUNT_NAV].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 font-bold text-ink-2 shadow-sm hover:border-ring"
          >
            <Icon className="size-5 text-primary" aria-hidden="true" />
            {label}
            <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        ))}
        <div className="rounded-2xl border bg-card p-2 shadow-sm">
          <LogoutButton />
        </div>
      </nav>
    </>
  );
}
