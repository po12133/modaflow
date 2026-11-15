import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Brand } from "@modaflow/ui/components/brand";
import { BottomNav } from "@/components/dashboard/bottom-nav";
import { LogoutButton, StoreAvatar } from "@/components/dashboard/common";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { SubscriptionStrip } from "@/components/dashboard/subscription-strip";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { getDashboardContext } from "@/lib/dal";
import { initials, ROLE_LABELS, STATUS_LABELS } from "@modaflow/ui/lib/format";
import { cn } from "@modaflow/ui/lib/utils";

export const metadata: Metadata = { title: { default: "Panel", template: "%s · ModaFlow" }, robots: { index: false } };

// Every panel route reads the session: let it render on the server per request.
export const instant = false;

async function DashboardShell({ children }: { children: React.ReactNode }) {
  const { me, store, subscription } = await getDashboardContext();
  const { limits } = subscription;

  return (
    <div className="min-h-dvh bg-[#f6f5fb] lg:grid lg:grid-cols-[256px_minmax(0,1fr)] print:block print:bg-white">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh print:hidden flex-col gap-4 overflow-y-auto border-r bg-white px-3 py-4 lg:flex">
        <Brand href="/dashboard" className="px-2" />
        <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-2.5">
          <StoreAvatar name={store.name} color={store.primaryColor} />
          <div className="min-w-0">
            <p className="truncate font-bold">{store.name}</p>
            <p className="truncate text-xs text-muted-foreground">Panel de la tienda</p>
          </div>
        </div>
        <SidebarNav />
        <div className="mt-auto grid gap-3 border-t pt-4">
          <div className="grid gap-3 px-1">
            <UsageMeter label="Productos" used={limits.products.used} limit={limits.products.limit} />
            <UsageMeter label="Análisis con IA" used={limits.aiAnalyses.used} limit={limits.aiAnalyses.limit} />
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex print:hidden items-center gap-3 border-b bg-[#f6f5fb]/90 px-4 py-3 backdrop-blur lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
            <StoreAvatar name={store.name} color={store.primaryColor} className="size-9" />
            <div className="min-w-0">
              <p className="truncate text-[0.95rem] leading-tight font-extrabold">{store.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                Plan {subscription.plan.name} · {STATUS_LABELS[subscription.status]}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "ml-auto hidden rounded-full px-2.5 py-1 text-xs font-bold lg:inline-flex",
              subscription.isOperational ? "bg-secondary text-violet-strong" : "bg-destructive/10 text-destructive",
            )}
          >
            Plan {subscription.plan.name} · {STATUS_LABELS[subscription.status]}
          </span>
          <Link
            href="/dashboard/cuenta"
            className="ml-auto flex items-center gap-2.5 rounded-xl p-1 hover:bg-white lg:ml-0"
            aria-label={`Mi cuenta: ${me.user.name}`}
          >
            <span className="grid size-9 place-items-center rounded-full bg-brand-gradient text-xs font-extrabold text-white">
              {initials(me.user.name)}
            </span>
            <span className="hidden min-w-0 text-left lg:block">
              <span className="block max-w-40 truncate text-sm font-bold">{me.user.name}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_LABELS[me.membership.role]}</span>
            </span>
          </Link>
        </header>

        <div className="print:hidden">
          <SubscriptionStrip subscription={subscription} />
        </div>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 lg:px-6 lg:pb-10 print:max-w-none print:p-0">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-[#f6f5fb] lg:grid lg:grid-cols-[256px_minmax(0,1fr)]" aria-busy="true">
      <div className="hidden border-r bg-white lg:block" />
      <div className="grid content-start gap-4 p-4 lg:p-6">
        <span className="sr-only">Cargando tu panel…</span>
        <div className="h-10 w-48 animate-pulse rounded-xl bg-muted" />
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
