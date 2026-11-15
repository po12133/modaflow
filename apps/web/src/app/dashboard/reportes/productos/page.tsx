import type { Metadata } from "next";
import { ProductFilters } from "@/components/reports/products/product-filters";
import { ProductList } from "@/components/reports/products/product-list";
import { ProductRankings } from "@/components/reports/products/product-rankings";
import { LockedPanel } from "@/components/reports/ui/locked-panel";
import { NoReportAccess } from "@/components/reports/ui/no-report-access";
import { ReportShell } from "@/components/reports/ui/report-shell";
import { getCategories, getDashboardContext } from "@/lib/dal";
import { periodParams } from "@/lib/reports";
import { toQuery } from "@modaflow/ui/lib/query";
import { searchParam as one } from "@modaflow/ui/lib/search-params";
import { getProductsReport, getReportSummary } from "@/services/reports";

export const metadata: Metadata = { title: "Productos vendidos" };

export const instant = false;

export default async function ProductsReportPage({ searchParams }: PageProps<"/dashboard/reportes/productos">) {
  const [{ me, subscription }, sp] = await Promise.all([getDashboardContext(), searchParams]);
  if (me.membership.role === "SELLER") return <NoReportAccess />;
  const pq = periodParams(sp);
  const filters = { categoryId: one(sp.categoryId), productId: one(sp.productId), search: one(sp.search), sort: one(sp.sort) };
  const page = Math.max(1, Number(one(sp.page)) || 1);

  if (!subscription.features.advancedReports) {
    const summary = await getReportSummary(pq);
    return (
      <ReportShell title="Productos vendidos" store={summary.store} period={summary.period} periodQuery={pq} exportQuery={{}} tab="/productos" advanced={false}>
        <LockedPanel title="Productos vendidos" operational={subscription.isOperational} />
      </ReportShell>
    );
  }

  const [report, categories] = await Promise.all([getProductsReport(pq, { ...filters, page }), getCategories()]);
  return (
    <ReportShell
      title="Productos vendidos"
      store={report.store}
      period={report.period}
      periodQuery={pq}
      exportQuery={{ ...pq, ...filters, report: "products" }}
      tab="/productos"
      advanced
    >
      <ProductFilters
        values={filters}
        categories={categories}
        productName={report.items.find((i) => i.productId === filters.productId)?.name}
        clearProductHref={`/dashboard/reportes/productos${toQuery({ ...pq, categoryId: filters.categoryId, sort: filters.sort })}`}
      />
      <ProductRankings report={report} sort={filters.sort ?? "units_desc"} showRanking={page === 1} />
      <ProductList report={report} period={pq} filters={filters} />
    </ReportShell>
  );
}
