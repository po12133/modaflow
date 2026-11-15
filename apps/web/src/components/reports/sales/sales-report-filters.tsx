import { PAYMENT_LABELS } from "@modaflow/ui/lib/format";
import type { SalesReport } from "@/types/reports";
import { UrlSearch, UrlSelect } from "../controls/url-fields";

export interface SalesReportFilterValues {
  paymentMethod?: string;
  sellerId?: string;
  status?: string;
  number?: string;
  sort?: string;
}

export function SalesReportFilters({ values, sellers }: { values: SalesReportFilterValues; sellers: SalesReport["sellers"] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <UrlSelect name="paymentMethod" label="Método" value={values.paymentMethod ?? ""} options={[["", "Todos"], ...(Object.entries(PAYMENT_LABELS) as [string, string][])]} />
      {sellers.length > 1 && (
        <UrlSelect name="sellerId" label="Vendedor" value={values.sellerId ?? ""} options={[["", "Todos"], ...sellers.map((s) => [s.id, s.name] as [string, string])]} />
      )}
      <UrlSelect name="status" label="Estado" value={values.status ?? ""} options={[["", "Todas"], ["COMPLETED", "Completadas"], ["CANCELED", "Anuladas"]]} />
      <UrlSelect name="sort" label="Orden" value={values.sort ?? "desc"} options={[["desc", "Más recientes"], ["asc", "Más antiguas"]]} />
      <div className="col-span-2 grid gap-1 text-xs font-semibold text-ink-2 sm:col-span-1">
        N.º de venta
        <UrlSearch name="number" label="Buscar por número de venta" placeholder="V-000012" value={values.number ?? ""} />
      </div>
    </div>
  );
}
