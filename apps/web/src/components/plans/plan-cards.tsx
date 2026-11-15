import type { ReactNode } from "react";
import { Check, Crown } from "lucide-react";
import { formatNumber, formatPrice } from "@modaflow/ui/lib/format";
import type { Plan } from "@/lib/types";
import { cn } from "@modaflow/ui/lib/utils";

export function PlanCards({
  plans,
  currentPlanCode,
  renderAction,
}: {
  plans: Plan[];
  currentPlanCode?: string;
  renderAction?: (plan: Plan) => ReactNode;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => {
        const current = plan.code === currentPlanCode;
        return (
          <li
            key={plan.id}
            className={cn(
              "relative flex flex-col rounded-[22px] border bg-card p-5 shadow-sm",
              plan.isRecommended && "border-2 border-primary shadow-[0_24px_60px_-18px_rgba(44,26,120,0.32)]",
            )}
          >
            {plan.isRecommended && (
              <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-brand-gradient px-3 py-1 text-xs font-bold whitespace-nowrap text-white">
                <Crown className="size-3.5" aria-hidden="true" /> Recomendado
              </span>
            )}
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-extrabold">{plan.name}</h3>
              {current && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-violet-strong">Tu plan</span>}
            </div>
            <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.tagline}</p>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold tracking-tight">{formatPrice(plan.priceCents)}</span>
              <span className="text-sm font-semibold text-muted-foreground">
                {plan.isTrial ? `· ${plan.durationDays} días` : "/mes"}
              </span>
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {[
                ["Productos", formatNumber(plan.limits.products)],
                [plan.limits.aiAnalysesPeriod === "TOTAL" ? "IA en total" : "IA / mes", formatNumber(plan.limits.aiAnalyses)],
                ["Usuarios", formatNumber(plan.limits.users)],
                ["Sucursales", formatNumber(plan.limits.branches)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-muted/70 px-2.5 py-2">
                  <dt className="text-[0.68rem] font-bold tracking-wide text-muted-foreground uppercase">{label}</dt>
                  <dd className="font-extrabold">{value}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-4 grid gap-1.5 text-sm">
              {plan.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-mint" aria-hidden="true" />
                  {h}
                </li>
              ))}
            </ul>
            {renderAction && <div className="mt-5 pt-1">{renderAction(plan)}</div>}
          </li>
        );
      })}
    </ul>
  );
}
