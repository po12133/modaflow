import { UsageMeter } from "@/components/dashboard/usage-meter";
import { formatShortDate } from "@modaflow/ui/lib/format";
import type { Entitlements } from "@/lib/types";

export function UsageCard({ sub }: { sub: Entitlements }) {
  const ai = sub.limits.aiAnalyses;
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold text-muted-foreground">Límites y consumo</h2>
      <div className="mt-4 grid gap-4">
        <UsageMeter label="Productos registrados" used={sub.limits.products.used} limit={sub.limits.products.limit} />
        <UsageMeter
          label="Análisis con IA"
          used={ai.used}
          limit={ai.limit}
          detail={ai.period === "TOTAL" ? "Total durante la prueba gratuita" : `Periodo ${formatShortDate(ai.periodStart)} – ${formatShortDate(ai.periodEnd)}`}
        />
        <UsageMeter label="Usuarios" used={sub.limits.users.used} limit={sub.limits.users.limit} capacity />
        <UsageMeter label="Sucursales" used={sub.limits.branches.used} limit={sub.limits.branches.limit} capacity />
      </div>
    </div>
  );
}
