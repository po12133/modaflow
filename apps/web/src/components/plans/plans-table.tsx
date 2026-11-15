import type { ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import { formatNumber, formatPrice } from "@/lib/format";
import type { Plan } from "@/lib/types";
import { cn } from "@/lib/utils";

const yes = (
  <>
    <Check className="mx-auto size-5 text-mint" aria-hidden="true" />
    <span className="sr-only">Sí</span>
  </>
);
const no = (
  <>
    <Minus className="mx-auto size-5 text-[#c9c5d8]" aria-hidden="true" />
    <span className="sr-only">No</span>
  </>
);

const ROWS: { label: string; value: (p: Plan) => ReactNode }[] = [
  { label: "Precio", value: (p) => (p.isTrial ? `${formatPrice(p.priceCents)} · ${p.durationDays} días` : `${formatPrice(p.priceCents)}/mes`) },
  { label: "Productos", value: (p) => formatNumber(p.limits.products) },
  {
    label: "Análisis con IA",
    value: (p) => `${formatNumber(p.limits.aiAnalyses)} ${p.limits.aiAnalysesPeriod === "TOTAL" ? "en total" : "al mes"}`,
  },
  { label: "Usuarios", value: (p) => formatNumber(p.limits.users) },
  { label: "Sucursales", value: (p) => formatNumber(p.limits.branches) },
  { label: "Inventario y ventas", value: (p) => (p.features.inventoryAndSales ? yes : no) },
  { label: "Reportes avanzados", value: (p) => (p.features.advancedReports ? yes : no) },
  {
    label: "Catálogo online",
    value: (p) =>
      p.features.onlineCatalog === "FULL" ? yes : p.features.onlineCatalog === "TEMPORARY" ? "Temporal" : no,
  },
  { label: "Gestión avanzada", value: (p) => (p.features.advancedManagement ? yes : no) },
];

/** Side-by-side comparison; scrolls horizontally on small screens with the first column pinned. */
export function PlansTable({ plans, currentPlanCode }: { plans: Plan[]; currentPlanCode?: string }) {
  return (
    // `relative` contains the absolutely positioned sr-only labels inside the scroller;
    // without it they escape the overflow clip and widen the mobile page.
    <div className="relative overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <caption className="sr-only">Comparación de planes de ModaFlow</caption>
        <thead>
          <tr className="border-b bg-[#fbfaff]">
            <th scope="col" className="sticky left-0 bg-[#fbfaff] px-3 py-3 text-left text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
              Función
            </th>
            {plans.map((p) => (
              <th
                key={p.id}
                scope="col"
                className={cn("px-3 py-3 text-center", p.isRecommended && "bg-secondary text-violet-strong")}
              >
                <span className="block font-extrabold">{p.name}</span>
                {p.isRecommended && <span className="block text-[0.65rem] font-bold uppercase">Recomendado</span>}
                {p.code === currentPlanCode && <span className="block text-[0.65rem] font-bold text-primary uppercase">Tu plan</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label} className="border-b last:border-0">
              <th scope="row" className="sticky left-0 bg-card px-3 py-2.5 text-left font-semibold text-ink-2">
                {row.label}
              </th>
              {plans.map((p) => (
                <td key={p.id} className={cn("px-3 py-2.5 text-center font-semibold", p.isRecommended && "bg-secondary/50")}>
                  {row.value(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
