import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Camera, ChartLine, ChevronRight, Clock, Package, PartyPopper, ShoppingCart } from "lucide-react";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { getDashboardContext, getPlanChangeRequests } from "@/lib/dal";
import { formatDate, plural, STATUS_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inicio" };

// Per-request page (reads the session through the API).
export const instant = false;

const SOON_TAG = (
  <span className="rounded-full bg-white/25 px-2 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase">
    En desarrollo
  </span>
);

export default async function DashboardHome({ searchParams }: PageProps<"/dashboard">) {
  const [{ me, store, subscription }, requests, params] = await Promise.all([
    getDashboardContext(),
    getPlanChangeRequests(),
    searchParams,
  ]);
  const firstName = me.user.name.split(" ")[0];
  const pending = requests.find((r) => r.status === "PENDING");
  const { limits } = subscription;

  return (
    <div className="grid gap-5">
      {params.bienvenida === "1" && subscription.status === "TRIALING" && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-brand-gradient p-4 text-white shadow-lg">
          <PartyPopper className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p className="text-sm">
            <strong className="block text-base">¡{store.name} ya está en ModaFlow!</strong>
            Tu prueba gratuita de 14 días comenzó hoy y termina el {formatDate(subscription.expiresAt)}.
          </p>
        </div>
      )}

      <header>
        <p className="text-sm text-muted-foreground">{store.name}</p>
        <h1 className="text-2xl font-extrabold tracking-tight">Hola, {firstName}</h1>
      </header>

      {/* Quick actions (prototype "hero actions") */}
      <section aria-labelledby="quick-actions" className="grid gap-3">
        <h2 id="quick-actions" className="sr-only">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/productos/nuevo"
            className="grid min-h-32 content-start gap-1 rounded-[20px] bg-brand-gradient p-4 text-white shadow-[0_16px_30px_-18px_rgba(22,19,43,0.6)] transition-transform active:scale-[0.98]"
          >
            <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-white/20">
              <Camera className="size-6" aria-hidden="true" />
            </span>
            <b className="text-base leading-tight">Registrar prenda</b>
            <span className="text-xs opacity-90">Con foto e IA</span>
          </Link>
          <Link
            href="/dashboard/vender"
            className="grid min-h-32 content-start gap-1 rounded-[20px] bg-gradient-to-br from-[#16132b] to-[#3b2f7a] p-4 text-white shadow-[0_16px_30px_-18px_rgba(22,19,43,0.6)] transition-transform active:scale-[0.98]"
          >
            <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-white/20">
              <ShoppingCart className="size-6" aria-hidden="true" />
            </span>
            <b className="text-base leading-tight">Nueva venta</b>
            {SOON_TAG}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/dashboard/productos", label: "Inventario", icon: Package, note: `${limits.products.used} productos` },
            { href: "/dashboard/reportes", label: "Reportes", icon: ChartLine, note: "En desarrollo" },
          ].map(({ href, label, icon: Icon, note }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm hover:border-ring"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold">{label}</span>
                <span className="block text-xs text-muted-foreground">{note}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Subscription summary */}
      <section aria-labelledby="subscription-title" className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="subscription-title" className="text-sm font-semibold text-muted-foreground">
              Tu plan
            </h2>
            <p className="mt-0.5 text-xl font-extrabold">
              {subscription.plan.name}{" "}
              <span
                className={cn(
                  "ml-1 rounded-full px-2 py-0.5 align-middle text-xs font-bold",
                  subscription.isOperational ? "bg-mint/15 text-[#0b7a66]" : "bg-destructive/10 text-destructive",
                )}
              >
                {STATUS_LABELS[subscription.status]}
              </span>
            </p>
          </div>
          {subscription.isOperational && (
            <div className="text-right">
              <p className="text-3xl leading-none font-extrabold text-primary">{subscription.daysRemaining}</p>
              <p className="text-xs font-semibold text-muted-foreground">
                {subscription.daysRemaining === 1 ? "día restante" : "días restantes"}
              </p>
            </div>
          )}
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="size-4" aria-hidden="true" />
          {subscription.isOperational
            ? `Vence el ${formatDate(subscription.expiresAt)}`
            : `Venció el ${formatDate(subscription.expiresAt)}`}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <UsageMeter label="Productos" used={limits.products.used} limit={limits.products.limit} />
          <UsageMeter
            label="Análisis con IA"
            used={limits.aiAnalyses.used}
            limit={limits.aiAnalyses.limit}
            detail={limits.aiAnalyses.period === "TOTAL" ? "Total de la prueba" : "Se renuevan cada mes"}
          />
          <UsageMeter label="Usuarios" used={limits.users.used} limit={limits.users.limit} capacity />
          <UsageMeter label="Sucursales" used={limits.branches.used} limit={limits.branches.limit} capacity />
        </div>
        <Link
          href="/dashboard/suscripcion"
          className="mt-4 flex items-center justify-between rounded-xl bg-muted/70 px-3 py-2.5 text-sm font-bold text-violet-strong hover:bg-secondary"
        >
          Ver detalles y comparar planes
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </section>

      {/* Notices */}
      {(pending || (subscription.status === "TRIALING" && subscription.daysRemaining <= 3)) && (
        <section aria-labelledby="notices-title" className="grid gap-2">
          <h2 id="notices-title" className="text-sm font-bold text-muted-foreground">
            Avisos
          </h2>
          {subscription.status === "TRIALING" && subscription.daysRemaining <= 3 && (
            <p className="flex items-center gap-2.5 rounded-xl border border-[#f5dfa8] bg-[#fff7e6] px-3.5 py-3 text-sm font-semibold text-[#7a4f00]">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              Tu prueba termina en {plural(subscription.daysRemaining, "día")}. Elige un plan para no perder el acceso.
            </p>
          )}
          {pending && (
            <p className="flex items-center gap-2.5 rounded-xl border border-[#c9dafc] bg-[#e7efff] px-3.5 py-3 text-sm font-semibold text-[#2357b8]">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              Solicitaste el plan {pending.toPlan}. Te contactaremos para coordinar el pago.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
