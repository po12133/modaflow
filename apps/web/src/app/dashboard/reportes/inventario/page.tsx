import type { Metadata } from "next";
import { InventoryKpis } from "@/components/reports/inventory/inventory-kpis";
import { LowStockPanel } from "@/components/reports/inventory/low-stock-panel";
import { MovementsPanel } from "@/components/reports/inventory/movements-panel";
import { LockedPanel } from "@/components/reports/ui/locked-panel";
import { NoReportAccess } from "@/components/reports/ui/no-report-access";
import { ReportShell } from "@/components/reports/ui/report-shell";
import { getDashboardContext } from "@/lib/dal";
import { periodParams } from "@/lib/reports";
import { searchParam as one } from "@modaflow/ui/lib/search-params";
import { getInventoryReport } from "@/services/reports";

export const metadata: Metadata = { title: "Reporte de inventario" };

export const instant = false;

export default async function InventoryReportPage({ searchParams }: PageProps<"/dashboard/reportes/inventario">) {
  const [{ me, subscription }, sp] = await Promise.all([getDashboardContext(), searchParams]);
  if (me.membership.role === "SELLER") return <NoReportAccess />;
  const pq = periodParams(sp);
  const lowStock = ["1", "2", "5"].includes(one(sp.lowStock) ?? "") ? one(sp.lowStock) : undefined;
  const includeUnique = one(sp.includeUnique) === "true" ? "true" : undefined;
  const inv = await getInventoryReport(pq, { lowStock, includeUnique });
  const advanced = subscription.features.advancedReports;

  return (
    <ReportShell
      title="Reporte de inventario"
      store={inv.store}
      period={inv.period}
      periodQuery={pq}
      exportQuery={{ ...pq, lowStock, includeUnique, report: "inventory" }}
      tab="/inventario"
      advanced={advanced}
    >
      <InventoryKpis stock={inv.stock} value={inv.value} lowStock={inv.lowStock.total} />
      <LowStockPanel lowStock={inv.lowStock} threshold={lowStock} includeUnique={Boolean(includeUnique)} />
      {inv.movements ? (
        <MovementsPanel movements={inv.movements} />
      ) : (
        !advanced && <LockedPanel title="Valor del inventario y movimientos" operational={subscription.isOperational} />
      )}
    </ReportShell>
  );
}
