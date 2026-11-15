import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { formatDate, STATUS_LABELS } from "@modaflow/ui/lib/format";
import type { Entitlements } from "@/lib/types";
import { cn } from "@modaflow/ui/lib/utils";

export function SubscriptionSummary({ subscription }: { subscription: Entitlements }) {
  return (
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
          <UsageMeter label="Productos" used={subscription.limits.products.used} limit={subscription.limits.products.limit} />
          <UsageMeter
            label="Análisis con IA"
            used={subscription.limits.aiAnalyses.used}
            limit={subscription.limits.aiAnalyses.limit}
            detail={subscription.limits.aiAnalyses.period === "TOTAL" ? "Total de la prueba" : "Se renuevan cada mes"}
          />
          <UsageMeter label="Usuarios" used={subscription.limits.users.used} limit={subscription.limits.users.limit} capacity />
          <UsageMeter label="Sucursales" used={subscription.limits.branches.used} limit={subscription.limits.branches.limit} capacity />
        </div>
        <Link
          href="/dashboard/suscripcion"
          className="mt-4 flex items-center justify-between rounded-xl bg-muted/70 px-3 py-2.5 text-sm font-bold text-violet-strong hover:bg-secondary"
        >
          Ver detalles y comparar planes
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
  );
}
