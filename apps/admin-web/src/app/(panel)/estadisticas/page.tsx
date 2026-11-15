import type { Metadata } from "next";
import { StatsSections } from "@/components/stats-sections";
import { PeriodPicker } from "@modaflow/ui/components/period-picker";
import { ADMIN_PERIODS } from "@/config/admin";
import { searchParam as one } from "@modaflow/ui/lib/search-params";
import { getAdminStatistics } from "@/services/admin";

export const metadata: Metadata = { title: "Estadísticas" };

export const instant = false;

export default async function StatisticsPage({ searchParams }: PageProps<"/estadisticas">) {
  const sp = await searchParams;
  const period = ADMIN_PERIODS.some(([k]) => k === one(sp.period)) ? one(sp.period) : "this_month";
  const custom = period === "custom" && one(sp.from) && one(sp.to) ? { from: one(sp.from), to: one(sp.to) } : {};
  const stats = await getAdminStatistics({ period: period === "custom" && !custom.from ? "this_month" : period, ...custom });
  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Estadísticas</h1>
        <p className="text-sm font-semibold text-ink-2">{stats.period.label} · {stats.period.from} a {stats.period.to}</p>
      </header>
      <PeriodPicker period={stats.period.key} from={stats.period.from} to={stats.period.to} options={ADMIN_PERIODS} />
      <StatsSections stats={stats} />
      <p className="text-xs text-muted-foreground">Ingresos = suscripciones cobradas (pagos aprobados). Las ventas de ropa de las tiendas no son ingresos de ModaFlow y solo se muestran como conteo agregado.</p>
    </div>
  );
}
