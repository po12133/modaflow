import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Receipt as ReceiptIcon } from "lucide-react";
import { PageHeader } from "@/components/dashboard/common";
import { Pagination } from "@/components/pagination";
import { SalesFilters, type SalesFilterValues } from "@/components/sales/sales-filters";
import { SaleStatusBadge } from "@/components/sales/sale-status-badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDateTime, formatMoney, PAYMENT_LABELS } from "@/lib/format";
import type { SalesList } from "@/lib/types";

export const metadata: Metadata = { title: "Ventas" };

// Per-request page (reads the session through the API).
export const instant = false;

const KEYS = ["period", "from", "to", "status", "paymentMethod", "number", "page"] as const;

export default async function SalesPage({ searchParams }: PageProps<"/dashboard/ventas">) {
  const raw = await searchParams;
  const params: Record<string, string | undefined> = {};
  for (const k of KEYS) {
    const v = raw[k];
    params[k] = typeof v === "string" && v.trim() ? v.trim().slice(0, 20) : undefined;
  }
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  qs.set("pageSize", "20");
  const list = await api<SalesList>(`/sales?${qs}`);

  return (
    <div className="grid gap-1">
      <PageHeader
        title="Ventas"
        description={`${list.summary.count} ${list.summary.count === 1 ? "venta efectiva" : "ventas efectivas"} · ${formatMoney(list.summary.total)} (sin anuladas)`}
        action={
          <Button asChild size="lg" className="h-11 bg-brand-gradient font-bold">
            <Link href="/dashboard/ventas/nueva">
              <Plus aria-hidden="true" /> Nueva venta
            </Link>
          </Button>
        }
      />
      <SalesFilters values={params as SalesFilterValues} />

      {list.items.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          <ReceiptIcon className="size-8" aria-hidden="true" />
          No hay ventas para mostrar.
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="grid gap-2 lg:hidden">
            {list.items.map((s) => (
              <li key={s.id}>
                <Link href={`/dashboard/ventas/${s.id}`} className="block rounded-2xl border bg-card p-3.5 shadow-sm active:scale-[0.99]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-extrabold">{s.number}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className={s.status === "CANCELED" ? "font-extrabold text-muted-foreground line-through" : "text-lg font-extrabold"}>{formatMoney(s.total)}</p>
                      <SaleStatusBadge status={s.status} />
                    </div>
                  </div>
                  <p className="mt-1.5 truncate text-sm text-ink-2">{s.preview.join(", ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.unitCount} {s.unitCount === 1 ? "prenda" : "prendas"} · {PAYMENT_LABELS[s.paymentMethod]} · {s.seller}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-sm lg:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Ventas</caption>
              <thead className="bg-[#fbfaff] text-left text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">N.º</th>
                  <th scope="col" className="px-3 py-3">Fecha</th>
                  <th scope="col" className="px-3 py-3">Prendas</th>
                  <th scope="col" className="px-3 py-3">Atendió</th>
                  <th scope="col" className="px-3 py-3">Pago</th>
                  <th scope="col" className="px-3 py-3 text-right">Total</th>
                  <th scope="col" className="px-3 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-3 font-extrabold">{s.number}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(s.createdAt)}</td>
                    <td className="max-w-xs px-3 py-3"><span className="line-clamp-2">{s.preview.join(", ")}</span><span className="text-xs text-muted-foreground">{s.unitCount} u.</span></td>
                    <td className="px-3 py-3">{s.seller}</td>
                    <td className="px-3 py-3">{PAYMENT_LABELS[s.paymentMethod]}</td>
                    <td className={s.status === "CANCELED" ? "px-3 py-3 text-right text-muted-foreground line-through" : "px-3 py-3 text-right font-bold"}>{formatMoney(s.total)}</td>
                    <td className="px-3 py-3"><SaleStatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/dashboard/ventas/${s.id}`} className="font-semibold text-primary">Ver</Link>
                      <Link href={`/dashboard/ventas/${s.id}/boleta`} className="ml-3 font-semibold text-primary">Boleta</Link>
                      <a href={`/api/sales/${s.id}/receipt-pdf?download=1`} className="ml-3 font-semibold text-primary">PDF</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination basePath="/dashboard/ventas" params={params} page={list.page} totalPages={list.totalPages} total={list.total} noun="ventas" />
        </>
      )}
    </div>
  );
}
