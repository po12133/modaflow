import type { Metadata } from "next";
import { InventoryOverview } from "@/components/reports/overview/inventory-overview";
import { ReportLinks } from "@/components/reports/overview/report-links";
import { SummaryCharts } from "@/components/reports/overview/summary-charts";
import { SummaryKpis } from "@/components/reports/overview/summary-kpis";
import { LockedPanel } from "@/components/reports/ui/locked-panel";
import { NoReportAccess } from "@/components/reports/ui/no-report-access";
import { ReportShell } from "@/components/reports/ui/report-shell";
import { getDashboardContext } from "@/lib/dal";
import { periodParams, toQuery } from "@/lib/reports";
import { getInventoryReport, getPaymentMethods, getProductsReport, getReportSummary, getSalesChart } from "@/services/reports";

export const metadata: Metadata = { title: "Reportes" };

export const instant = false;

export default async function ReportsPage({ searchParams }: PageProps<"/dashboard/reportes">) {
  const [{ me, subscription }, sp] = await Promise.all([getDashboardContext(), searchParams]);
  if (me.membership.role === "SELLER") return <NoReportAccess />;
  const pq = periodParams(sp);
  const q = toQuery({ ...pq });
  const advanced = subscription.features.advancedReports;
  const [summary, inventory, chart, methods, products] = await Promise.all([
    getReportSummary(pq),
    getInventoryReport(pq, {}),
    advanced ? getSalesChart(pq) : null,
    advanced ? getPaymentMethods(pq) : null,
    advanced ? getProductsReport(pq, { pageSize: 10 }) : null,
  ]);

  return (
    <ReportShell
      title="Reportes"
      store={summary.store}
      period={summary.period}
      periodQuery={pq}
      exportQuery={{ ...pq, report: "summary" }}
      tab=""
      advanced={advanced}
    >
      <SummaryKpis summary={summary} />
      {chart && methods && products ? (
        <SummaryCharts
          chart={chart}
          methods={methods.items}
          products={products}
          previousLabel={summary.period.previous.label}
          productsHref={`/dashboard/reportes/productos${q}`}
        />
      ) : (
        <LockedPanel title="Reportes avanzados" operational={subscription.isOperational} />
      )}
      <InventoryOverview inventory={inventory} href={`/dashboard/reportes/inventario${q}`} />
      <ReportLinks query={q} />
    </ReportShell>
  );
}
