import Link from "next/link";
import { KpiCard } from "@modaflow/ui/components/kpi-card";
import { formatMoney } from "@modaflow/ui/lib/format";
import type { AdminKpis } from "@/types/admin";

export function DashboardKpis({ kpis }: { kpis: AdminKpis }) {
  return (
    <div className="grid gap-3">
      {kpis.pendingPayments.count > 0 && (
        <Link href="/pagos?status=PENDING" className="rounded-2xl border border-amber/40 bg-[#fff7e6] p-4 font-semibold text-[#7a4f00]">
          {kpis.pendingPayments.count} {kpis.pendingPayments.count === 1 ? "pago pendiente" : "pagos pendientes"} de revisión ({formatMoney(kpis.pendingPayments.amount)}). Revisar ahora →
        </Link>
      )}
      <section aria-label="Ingresos" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Cobrado este mes" value={formatMoney(kpis.revenueThisMonth)} tone="primary" hint="Pagos aprobados" />
        <KpiCard label="Cobrado acumulado" value={formatMoney(kpis.revenueTotal)} hint="Pagos aprobados" />
        <KpiCard label="Pendiente de revisión" value={formatMoney(kpis.pendingPayments.amount)} hint="No es ingreso todavía" />
        <KpiCard label="MRR estimado" value={formatMoney(kpis.mrr)} hint={kpis.arpu ? `ARPU ${formatMoney(kpis.arpu)}` : "Suscripciones pagadas activas"} />
      </section>
      <section aria-label="Negocios" className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard label="Negocios" value={String(kpis.tenants)} />
        <KpiCard label="Activos" value={String(kpis.activeTenants)} />
        <KpiCard label="En prueba" value={String(kpis.trials)} />
        <KpiCard label="Pagados activos" value={String(kpis.paidActive)} />
        <KpiCard label="Vencidos" value={String(kpis.expired)} />
        <KpiCard label="Suspendidos" value={String(kpis.suspended)} />
      </section>
    </div>
  );
}
