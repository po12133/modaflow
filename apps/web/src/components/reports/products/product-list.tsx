import { Pagination } from "@modaflow/ui/components/pagination";
import { toQuery } from "@modaflow/ui/lib/query";
import type { PeriodParams, ProductsReport } from "@/types/reports";
import type { ProductFilterValues } from "./product-filters";
import { ProductRow } from "./product-row";

const BASE = "/dashboard/reportes/productos";

export function ProductList({ report, period, filters }: { report: ProductsReport; period: PeriodParams; filters: ProductFilterValues }) {
  return (
    <section aria-label="Productos" className="grid gap-2">
      <h2 className="font-extrabold">Detalle por producto</h2>
      {report.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">No hay productos vendidos con estos filtros.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
          {report.items.map((row, i) => (
            <ProductRow
              key={row.productId}
              row={row}
              rank={(report.page - 1) * report.pageSize + i + 1}
              variantsHref={`${BASE}${toQuery({ ...period, productId: row.productId, sort: filters.sort })}`}
            />
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Ingresos netos después de descuentos. Se calcula con las ventas registradas, no con el stock actual.</p>
      <Pagination basePath={BASE} params={{ ...period, ...filters }} page={report.page} totalPages={report.totalPages} total={report.total} noun="productos" />
    </section>
  );
}
