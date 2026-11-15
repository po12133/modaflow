import { Panel } from "@modaflow/ui/components/panel";
import { RankChart } from "@modaflow/ui/components/charts/rank-chart";
import type { AdminCharts } from "@/types/admin";
import { RevenueChart } from "./charts/revenue-chart";

export function DashboardCharts({ charts }: { charts: AdminCharts }) {
  const flows: [string, number][] = [
    ["Conversiones de prueba a pago", charts.conversions],
    ["Renovaciones", charts.renewals],
    ["Cancelaciones", charts.cancellations],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Evolución de ingresos cobrados" className="lg:col-span-2">
        <RevenueChart points={charts.points} metric="revenue" />
      </Panel>
      <Panel title="Nuevos negocios">
        <RevenueChart points={charts.points} metric="newTenants" />
      </Panel>
      <Panel title="Suscripciones vigentes por plan">
        <RankChart items={charts.subscriptionsByPlan.map((s) => ({ name: s.plan, value: s.count }))} format="units" label="Suscripciones por plan" />
      </Panel>
      <Panel title="Movimientos del periodo" className="lg:col-span-2">
        <dl className="grid grid-cols-3 gap-2 text-center">
          {flows.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-muted/60 px-2 py-3">
              <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-extrabold">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
