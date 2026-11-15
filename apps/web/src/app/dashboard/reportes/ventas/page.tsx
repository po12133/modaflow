import type { Metadata } from "next";
import { Pagination } from "@/components/pagination";
import { SalesTrendChart } from "@/components/reports/charts/trend-chart";
import { SalesReportCards } from "@/components/reports/sales/sales-report-cards";
import { SalesReportFilters } from "@/components/reports/sales/sales-report-filters";
import { SalesReportKpis } from "@/components/reports/sales/sales-report-kpis";
import { SalesReportTable } from "@/components/reports/sales/sales-report-table";
import { NoReportAccess } from "@/components/reports/ui/no-report-access";
import { Panel } from "@/components/common/panel";
import { ReportShell } from "@/components/reports/ui/report-shell";
import { getDashboardContext } from "@/lib/dal";
import { periodParams } from "@/lib/reports";
import { searchParam as one } from "@/lib/search-params";
import { getSalesChart, getSalesReport } from "@/services/reports";

export const metadata: Metadata = { title: "Reporte de ventas" };

export const instant = false;

export default async function SalesReportPage({ searchParams }: PageProps<"/dashboard/reportes/ventas">) {
  const [{ me, subscription }, sp] = await Promise.all([getDashboardContext(), searchParams]);
  if (me.membership.role === "SELLER") return <NoReportAccess />;
  const pq = periodParams(sp);
  const filters = { paymentMethod: one(sp.paymentMethod), sellerId: one(sp.sellerId), status: one(sp.status), number: one(sp.number), sort: one(sp.sort) };
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const advanced = subscription.features.advancedReports;
  const [report, chart] = await Promise.all([getSalesReport(pq, { ...filters, page }), advanced ? getSalesChart(pq) : null]);

  return (
    <ReportShell
      title="Reporte de ventas"
      store={report.store}
      period={report.period}
      periodQuery={pq}
      exportQuery={{ ...pq, paymentMethod: filters.paymentMethod, sellerId: filters.sellerId, status: filters.status, report: "sales" }}
      tab="/ventas"
      advanced={advanced}
    >
      <SalesReportFilters values={filters} sellers={report.sellers} />
      <SalesReportKpis kpis={report.kpis} />
      {chart && (
        <Panel title="Evolución de ventas">
          <SalesTrendChart points={chart.points} previousLabel={`Periodo anterior (${report.period.previous.label})`} />
        </Panel>
      )}
      <section aria-label="Ventas del periodo" className="grid gap-2">
        {report.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">No hay ventas con estos filtros.</p>
        ) : (
          <>
            <SalesReportCards items={report.items} />
            <SalesReportTable items={report.items} />
          </>
        )}
        <Pagination basePath="/dashboard/reportes/ventas" params={{ ...pq, ...filters }} page={report.page} totalPages={report.totalPages} total={report.total} noun="ventas" />
      </section>
    </ReportShell>
  );
}
