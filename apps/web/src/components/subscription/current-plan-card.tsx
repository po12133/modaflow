import { Check, Minus } from "lucide-react";
import { formatDate, STATUS_LABELS } from "@modaflow/ui/lib/format";
import type { Entitlements } from "@/lib/types";
import { cn } from "@modaflow/ui/lib/utils";

const FEATURE_LABELS = {
  inventoryAndSales: "Inventario y ventas",
  advancedReports: "Reportes avanzados",
  onlineCatalog: "Catálogo online",
  advancedManagement: "Gestión avanzada",
} as const;

export function CurrentPlanCard({ sub }: { sub: Entitlements }) {
  const details: [string, string][] = [
    ["Fecha de inicio", formatDate(sub.startedAt)],
    [sub.isOperational ? "Vence el" : "Venció el", formatDate(sub.expiresAt)],
    ["Días restantes", String(sub.daysRemaining)],
  ];
  if (sub.dataRetentionUntil) details.push(["Datos conservados hasta", formatDate(sub.dataRetentionUntil)]);
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold text-muted-foreground">Plan actual</h2>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-extrabold">
        {sub.plan.name}
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", sub.isOperational ? "bg-mint/15 text-[#0b7a66]" : "bg-destructive/10 text-destructive")}>
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
      {sub.status === "SUSPENDED" ? (
        <p className="mt-4 rounded-xl bg-[#fdeeee] px-3 py-2.5 text-sm text-[#9b1f26]">Tu negocio está suspendido. Puedes consultar tus datos; escribe a soporte de ModaFlow para reactivarlo.</p>
      ) : (
        !sub.isOperational && (
          <p className="mt-4 rounded-xl bg-[#fdeeee] px-3 py-2.5 text-sm text-[#9b1f26]">
            Tu cuenta está en modo de solo lectura: puedes consultar tus datos y pagar un plan, pero no registrar operaciones nuevas. No eliminamos tus datos automáticamente.
          </p>
        )
      )}
      <ul className="mt-4 grid grid-cols-2 gap-1.5 text-sm">
        {(Object.keys(FEATURE_LABELS) as (keyof typeof FEATURE_LABELS)[]).map((key) => (
          <li key={key} className={cn("flex items-center gap-2", !sub.features[key] && "text-muted-foreground")}>
            {sub.features[key] ? <Check className="size-4 text-mint" aria-hidden="true" /> : <Minus className="size-4 text-[#c9c5d8]" aria-hidden="true" />}
            {FEATURE_LABELS[key]}
            <span className="sr-only">{sub.features[key] ? "incluido" : "no incluido"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
