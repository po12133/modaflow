import type { Metadata } from "next";
import { Check, Minus, X } from "lucide-react";
import { cancelPlanChangeAction } from "@/actions/subscription";
import { PageHeader } from "@/components/dashboard/common";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { PlanCards } from "@/components/plans/plan-cards";
import { PlansTable } from "@/components/plans/plans-table";
import { RequestPlanForm } from "@/components/plans/request-plan-form";
import { getDashboardContext, getPlanChangeRequests, getPlans } from "@/lib/dal";
import { formatDate, formatShortDate, STATUS_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Suscripción" };

// Per-request page (reads the session through the API).
export const instant = false;

const FEATURE_LABELS = {
  inventoryAndSales: "Inventario y ventas",
  advancedReports: "Reportes avanzados",
  onlineCatalog: "Catálogo online",
  advancedManagement: "Gestión avanzada",
} as const;

const REQUEST_STATUS = { PENDING: "Pendiente", APPROVED: "Aprobada", REJECTED: "Rechazada", CANCELED: "Cancelada" } as const;

export default async function SubscriptionPage() {
  const [{ me, subscription: sub }, plans, requests] = await Promise.all([
    getDashboardContext(),
    getPlans(),
    getPlanChangeRequests(),
  ]);
  const pending = requests.find((r) => r.status === "PENDING");
  const isOwner = me.membership.role === "OWNER";
  const requestable = plans.filter((p) => !p.isTrial && !(p.code === sub.plan.code && sub.isOperational));

  const details: [string, string][] = [
    ["Fecha de inicio", formatDate(sub.startedAt)],
    [sub.isOperational ? "Vence el" : "Venció el", formatDate(sub.expiresAt)],
    ["Días restantes", String(sub.daysRemaining)],
  ];
  if (sub.dataRetentionUntil) details.push(["Datos conservados hasta", formatDate(sub.dataRetentionUntil)]);

  return (
    <div className="grid min-w-0 gap-6 *:min-w-0">
      <PageHeader title="Suscripción" description="Tu plan, su consumo y los planes disponibles." />

      <section aria-labelledby="current-plan" className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <h2 id="current-plan" className="text-sm font-semibold text-muted-foreground">
            Plan actual
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-extrabold">
            {sub.plan.name}
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-bold",
                sub.isOperational ? "bg-mint/15 text-[#0b7a66]" : "bg-destructive/10 text-destructive",
              )}
            >
              {STATUS_LABELS[sub.status]}
            </span>
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-muted/70 px-3 py-2.5">
                <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                <dd className="font-extrabold">{value}</dd>
              </div>
            ))}
          </dl>
          {!sub.isOperational && (
            <p className="mt-4 rounded-xl bg-[#fdeeee] px-3 py-2.5 text-sm text-[#9b1f26]">
              Tu cuenta está en modo de solo lectura: puedes consultar tus datos y solicitar un plan, pero no registrar
              operaciones nuevas. No eliminamos tus datos automáticamente.
            </p>
          )}
          <ul className="mt-4 grid grid-cols-2 gap-1.5 text-sm">
            {(Object.keys(FEATURE_LABELS) as (keyof typeof FEATURE_LABELS)[]).map((key) => (
              <li key={key} className={cn("flex items-center gap-2", !sub.features[key] && "text-muted-foreground")}>
                {sub.features[key] ? (
                  <Check className="size-4 text-mint" aria-hidden="true" />
                ) : (
                  <Minus className="size-4 text-[#c9c5d8]" aria-hidden="true" />
                )}
                {FEATURE_LABELS[key]}
                <span className="sr-only">{sub.features[key] ? "incluido" : "no incluido"}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Límites y consumo</h2>
          <div className="mt-4 grid gap-4">
            <UsageMeter label="Productos registrados" used={sub.limits.products.used} limit={sub.limits.products.limit} />
            <UsageMeter
              label="Análisis con IA"
              used={sub.limits.aiAnalyses.used}
              limit={sub.limits.aiAnalyses.limit}
              detail={
                sub.limits.aiAnalyses.period === "TOTAL"
                  ? "Total durante la prueba gratuita"
                  : `Periodo ${formatShortDate(sub.limits.aiAnalyses.periodStart)} – ${formatShortDate(sub.limits.aiAnalyses.periodEnd)}`
              }
            />
            <UsageMeter label="Usuarios" used={sub.limits.users.used} limit={sub.limits.users.limit} capacity />
            <UsageMeter label="Sucursales" used={sub.limits.branches.used} limit={sub.limits.branches.limit} capacity />
          </div>
        </div>
      </section>

      <section aria-labelledby="change-plan" className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <h2 id="change-plan" className="text-lg font-extrabold">
          Cambiar de plan
        </h2>
        {pending ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#c9dafc] bg-[#e7efff] px-3.5 py-3 text-sm text-[#2357b8]">
            <p>
              <strong>Solicitud pendiente:</strong> {pending.fromPlan} → {pending.toPlan} ({formatDate(pending.createdAt)}).
              Te contactaremos para coordinar el pago.
            </p>
            {isOwner && (
              <form action={cancelPlanChangeAction}>
                <input type="hidden" name="id" value={pending.id} />
                <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#2357b8] shadow-sm">
                  <X className="size-3.5" aria-hidden="true" /> Cancelar solicitud
                </button>
              </form>
            )}
          </div>
        ) : isOwner ? (
          <div className="mt-3">
            <RequestPlanForm plans={requestable} defaultPlan="pro" />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Solo la persona propietaria de la tienda puede solicitar un cambio de plan.</p>
        )}
        {requests.length > 0 && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-muted-foreground">Historial de solicitudes</summary>
            <ul className="mt-2 grid gap-1.5">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2">
                  <span>
                    {r.fromPlan} → {r.toPlan}
                  </span>
                  <span className="text-muted-foreground">
                    {REQUEST_STATUS[r.status]} · {formatShortDate(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section aria-labelledby="compare" className="grid gap-4 *:min-w-0">
        <h2 id="compare" className="text-lg font-extrabold">
          Compara los planes
        </h2>
        <div className="pt-3">
          <PlanCards plans={plans} currentPlanCode={sub.plan.code} />
        </div>
        <PlansTable plans={plans} currentPlanCode={sub.plan.code} />
        <p className="text-xs text-muted-foreground">
          Precios en bolivianos. Un producto es una ficha (por ejemplo, una blusa con 20 unidades cuenta como 1 producto).
        </p>
      </section>
    </div>
  );
}
