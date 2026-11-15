import { formatMoney } from "@modaflow/ui/lib/format";
import type { Kpis } from "@/types/reports";
import { KpiCard } from "@modaflow/ui/components/kpi-card";

export function SalesReportKpis({ kpis }: { kpis: Kpis }) {
  return (
    <>
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Total vendido" value={formatMoney(kpis.total)} tone="primary" />
        <KpiCard label="Ventas" value={String(kpis.sales)} />
        <KpiCard label="Prendas vendidas" value={String(kpis.units)} />
        <KpiCard label="Ticket promedio" value={formatMoney(kpis.averageTicket)} />
        <KpiCard label="Descuentos" value={formatMoney(kpis.discounts)} hint={`Por prenda ${formatMoney(kpis.itemsDiscount)} · general ${formatMoney(kpis.generalDiscount)}`} />
      </section>
      <p className="-mt-2 text-xs text-muted-foreground">Los totales no incluyen ventas anuladas ({kpis.canceled.sales}).</p>
    </>
  );
}
