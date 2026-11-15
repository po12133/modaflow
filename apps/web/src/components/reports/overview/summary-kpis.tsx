import Link from "next/link";
import { formatMoney, plural } from "@modaflow/ui/lib/format";
import type { GrossProfit, ReportSummary } from "@/types/reports";
import { KpiCard } from "@modaflow/ui/components/kpi-card";

function profitHint(profit: GrossProfit, sales: number): string {
  if (sales === 0) return "Sin ventas en el periodo";
  if (!profit.complete) return `${plural(profit.unitsWithoutCost, "prenda")} sin costo registrado (${formatMoney(profit.revenueWithoutCost)} no incluidos)`;
  return profit.marginPct === null ? "Estimación" : `Margen ${profit.marginPct.toLocaleString("es-BO")} % · estimación`;
}

export function SummaryKpis({ summary }: { summary: ReportSummary }) {
  const { kpis, profit, comparison } = summary;
  const ch = comparison?.changes;
  const canceled = kpis.canceled.sales;
  return (
    <>
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Total vendido" value={formatMoney(kpis.total)} change={ch?.total} tone="primary" />
        <KpiCard label="Ventas" value={String(kpis.sales)} change={ch?.sales} />
        <KpiCard label="Prendas vendidas" value={String(kpis.units)} change={ch?.units} />
        <KpiCard label="Ticket promedio" value={formatMoney(kpis.averageTicket)} change={ch?.averageTicket} />
        <KpiCard
          label="Descuentos aplicados"
          value={formatMoney(kpis.discounts)}
          hint={canceled > 0 ? `${plural(canceled, "venta anulada", "ventas anuladas")} no incluida${canceled === 1 ? "" : "s"}` : undefined}
        />
        {profit ? (
          <KpiCard
            label={profit.complete ? "Ganancia bruta estimada" : "Ganancia estimada (parcial)"}
            value={kpis.sales === 0 ? "—" : formatMoney(profit.grossProfit)}
            hint={profitHint(profit, kpis.sales)}
          />
        ) : (
          <KpiCard
            label="Ganancia bruta estimada"
            value="—"
            hint={
              <Link href="/dashboard/suscripcion" className="font-semibold text-primary">
                Disponible en plan Pro
              </Link>
            }
          />
        )}
      </section>
      {comparison && (
        <p className="-mt-1 text-xs text-muted-foreground">
          Comparado con {comparison.previous.label}. {comparison.rule}
        </p>
      )}
      {profit && kpis.sales > 0 && (
        <p className="-mt-2 text-xs text-muted-foreground">
          La ganancia bruta estimada es ventas netas menos el costo de compra registrado; no incluye gastos, impuestos ni comisiones.
        </p>
      )}
    </>
  );
}
