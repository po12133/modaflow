import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SaleStatusBadge } from "@/components/sales/sale-status-badge";
import { formatDate, formatMoney, PAYMENT_LABELS, plural } from "@modaflow/ui/lib/format";
import type { SalesSummary } from "@/lib/types";

const timeFmt = new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", timeZone: "America/La_Paz" });

export function TodaySales({ sales }: { sales: SalesSummary }) {
  return (
      <section aria-labelledby="today-title" className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="today-title" className="font-extrabold">Ventas de hoy</h2>
          <Link href="/dashboard/reportes?period=today" className="text-sm font-bold text-primary">
            Ver reporte
          </Link>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-muted/60 px-2 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">Ventas</dt>
            <dd className="text-2xl font-extrabold">{sales.today.sales}</dd>
          </div>
          <div className="rounded-xl bg-muted/60 px-2 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">Total</dt>
            <dd className="text-lg leading-8 font-extrabold whitespace-nowrap text-primary">{formatMoney(sales.today.total)}</dd>
          </div>
          <div className="rounded-xl bg-muted/60 px-2 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">Prendas</dt>
            <dd className="text-2xl font-extrabold">{sales.today.units}</dd>
          </div>
        </dl>
        <Link
          href="/dashboard/reportes?period=this_month"
          className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 px-3.5 py-2.5 text-sm"
        >
          <span>
            <span className="block text-xs font-semibold text-muted-foreground">Este mes</span>
            <b>{formatMoney(sales.month.total)}</b> · {plural(sales.month.sales, "venta")} · {plural(sales.month.units, "prenda")}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
        {sales.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no registraste ventas.</p>
        ) : (
          <ul className="divide-y">
            {sales.recent.map((sale) => (
              <li key={sale.id}>
                <Link href={`/dashboard/ventas/${sale.id}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{sale.number}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(sale.createdAt)} {timeFmt.format(new Date(sale.createdAt))} · {plural(sale.unitCount, "prenda")} · {PAYMENT_LABELS[sale.paymentMethod]}
                    </span>
                  </span>
                  {sale.status === "CANCELED" && <SaleStatusBadge status={sale.status} />}
                  <b className="whitespace-nowrap">{formatMoney(sale.total)}</b>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/dashboard/ventas" className="text-sm font-bold text-primary">
          Ver historial de ventas
        </Link>
      </section>
  );
}
