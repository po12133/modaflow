import type { Metadata } from "next";
import { DashboardCharts } from "@/components/admin/dashboard-charts";
import { DashboardKpis } from "@/components/admin/dashboard-kpis";
import { PeriodPicker } from "@/components/reports/controls/period-picker";
import { ADMIN_PERIODS } from "@/config/admin";
import { searchParam as one } from "@/lib/search-params";
import { getAdminDashboard } from "@/services/admin";

export const metadata: Metadata = { title: "Dashboard" };

export const instant = false;

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const period = ADMIN_PERIODS.some(([k]) => k === one(sp.period)) ? one(sp.period) : "this_month";
  const custom = period === "custom" && one(sp.from) && one(sp.to) ? { from: one(sp.from), to: one(sp.to) } : {};
  const data = await getAdminDashboard({ period: period === "custom" && !custom.from ? "this_month" : period, ...custom });

  return (
    <div className="grid gap-5">
      <header>
        <p className="text-sm text-muted-foreground">ModaFlow como negocio SaaS</p>
        <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="text-sm font-semibold text-ink-2">{data.period.label} · {data.period.from} a {data.period.to}</p>
      </header>
      <PeriodPicker period={data.period.key} from={data.period.from} to={data.period.to} options={ADMIN_PERIODS} />
      <DashboardKpis kpis={data.kpis} />
      <DashboardCharts charts={data.charts} />
      <p className="text-xs text-muted-foreground">Los ingresos son pagos de suscripciones aprobados. No incluyen las ventas de ropa de las tiendas ni pagos pendientes. El MRR es una estimación mensual de las suscripciones pagadas vigentes.</p>
    </div>
  );
}
