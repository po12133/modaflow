import { KpiCard } from "@/components/common/kpi-card";
import { Panel } from "@/components/common/panel";
import { RankChart } from "@/components/reports/charts/rank-chart";
import { formatMoney } from "@/lib/format";
import type { AdminStatistics } from "@/types/admin";

export function StatsSections({ stats }: { stats: AdminStatistics }) {
  const { revenue, conversion, usage, kpis } = stats;
  const usageRows: [string, number][] = [
    ["Negocios registrados", usage.tenants],
    ["Usuarios activos (30 días)", usage.activeUsers30d],
    ["Productos activos", usage.activeProducts],
    ["Análisis IA consumidos", usage.aiAnalyses],
    ["Ventas registradas por tiendas", usage.salesRegistered],
    ["Catálogos con productos publicados", usage.catalogsWithProducts],
    ["Solicitudes desde catálogos", usage.catalogRequests],
  ];
  return (
    <div className="grid gap-4">
      <section aria-label="Ingresos" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Cobrado en el periodo" value={formatMoney(revenue.inPeriod)} tone="primary" hint={`${revenue.paymentsInPeriod} pagos aprobados`} />
        <KpiCard label="Cobrado acumulado" value={formatMoney(kpis.revenueTotal)} />
        <KpiCard label="MRR estimado" value={formatMoney(kpis.mrr)} hint="No es dinero cobrado" />
        <KpiCard label="ARPU" value={kpis.arpu ? formatMoney(kpis.arpu) : "—"} hint="MRR / negocios pagadores" />
      </section>
      <section aria-label="Suscripciones" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Pagadas activas" value={String(kpis.paidActive)} />
        <KpiCard label="Vencidas" value={String(kpis.expired)} />
        <KpiCard label="Nuevas en el periodo" value={String(revenue.newSubscriptions)} />
        <KpiCard label="Renovaciones" value={String(stats.charts.renewals)} />
        <KpiCard label="Cancelaciones" value={String(stats.charts.cancellations)} />
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Ingresos por plan (periodo)">
          <RankChart items={revenue.byPlan.map((r) => ({ name: r.plan, value: Number(r.total), detail: `${r.payments} pagos` }))} format="money" label="Ingresos por plan" />
        </Panel>
        <Panel title="Evolución mensual (12 meses)">
          <RankChart items={revenue.monthly.map((m) => ({ name: m.month, value: Number(m.total) }))} format="money" label="Ingresos por mes" />
        </Panel>
        <Panel title="Conversión">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Usuarios registrados</dt><dd className="font-bold">{conversion.registeredUsers}</dd>
            <dt className="text-muted-foreground">Negocios con prueba</dt><dd className="font-bold">{conversion.trialTenants}</dd>
            <dt className="text-muted-foreground">Convertidos a pago</dt><dd className="font-bold">{conversion.convertedTenants}</dd>
            <dt className="text-muted-foreground">Conversión</dt><dd className="font-bold">{conversion.conversionPct === null ? "—" : `${conversion.conversionPct} %`}</dd>
          </dl>
        </Panel>
        <Panel title="Uso de la plataforma (agregado)">
          <dl className="grid grid-cols-[1fr_auto] gap-1 text-sm">
            {usageRows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-bold">{value.toLocaleString("es-BO")}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
