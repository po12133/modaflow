import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";
import { CancelSaleDialog } from "@/components/sales/cancel-sale-dialog";
import { SaleStatusBadge } from "@/components/sales/sale-status-badge";
import { MOVEMENT_LABELS } from "@/components/inventory/movement-list";
import { Button } from "@modaflow/ui/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { getDashboardContext } from "@/lib/dal";
import { formatDateTime, formatMoney, PAYMENT_LABELS, variantLabel } from "@modaflow/ui/lib/format";
import type { SaleDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Detalle de venta" };

// Per-request page (reads the session through the API).
export const instant = false;

async function getSale(id: string): Promise<SaleDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    return await api<SaleDetail>(`/sales/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function SaleDetailPage({ params }: PageProps<"/dashboard/ventas/[id]">) {
  const { id } = await params;
  const [{ me, subscription }, sale] = await Promise.all([getDashboardContext(), getSale(id)]);
  if (!sale) notFound();
  const canCancel = me.membership.role === "OWNER" && subscription.isOperational && sale.status === "COMPLETED";

  return (
    <div className="grid gap-5">
      <Link href="/dashboard/ventas" className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold text-primary">
        <ChevronLeft className="size-4" aria-hidden="true" /> Ventas
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Venta {sale.number}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(sale.createdAt)} · {sale.seller.name}
          </p>
        </div>
        <SaleStatusBadge status={sale.status} className="text-sm" />
      </header>

      {sale.cancellation && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <p className="font-bold text-destructive">Anulada el {formatDateTime(sale.cancellation.createdAt)} por {sale.cancellation.user}</p>
          <p className="mt-1">Motivo: {sale.cancellation.reason}</p>
          {sale.cancellation.notes && <p className="text-muted-foreground">{sale.cancellation.notes}</p>}
          <p className="mt-1 text-muted-foreground">
            Se devolvieron {sale.cancellation.restockedUnits} prendas al inventario. La devolución de dinero se gestiona por separado.
          </p>
        </div>
      )}

      <section aria-labelledby="items-title" className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 id="items-title" className="mb-3 font-extrabold">Prendas vendidas</h2>
        <ul className="divide-y">
          {sale.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <Link href={`/dashboard/productos/${item.productId}`} className="font-bold hover:text-primary">{item.productName}</Link>
                <p className="text-xs text-muted-foreground">{variantLabel(item)} · <span className="font-mono">{item.sku}</span></p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {formatMoney(item.unitPrice)}
                  {Number(item.unitDiscount) > 0 && (
                    <span className="text-[#0b7a66]">
                      {" "}− {formatMoney(item.unitDiscount)} c/u{item.discountType === "PERCENT" ? ` (${Number(item.discountValue)} %)` : ""}
                    </span>
                  )}
                </p>
              </div>
              <b className="whitespace-nowrap">{formatMoney(item.lineTotal)}</b>
            </li>
          ))}
        </ul>
        <dl className="mt-2 grid gap-1 border-t pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(sale.subtotal)}</dd></div>
          {Number(sale.itemsDiscount) > 0 && <div className="flex justify-between text-[#0b7a66]"><dt>Descuentos por prenda</dt><dd>− {formatMoney(sale.itemsDiscount)}</dd></div>}
          {Number(sale.discountAmount) > 0 && (
            <div className="flex justify-between text-[#0b7a66]">
              <dt>Descuento general{sale.discountType === "PERCENT" ? ` (${Number(sale.discountValue)} %)` : ""}</dt>
              <dd>− {formatMoney(sale.discountAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-xl font-extrabold"><dt>Total</dt><dd>{formatMoney(sale.total)}</dd></div>
          <div className="flex justify-between text-muted-foreground"><dt>Pago</dt><dd>{PAYMENT_LABELS[sale.paymentMethod]} · confirmado por la vendedora</dd></div>
          {sale.amountReceived && <div className="flex justify-between text-muted-foreground"><dt>Recibido / cambio</dt><dd>{formatMoney(sale.amountReceived)} / {formatMoney(sale.changeGiven ?? "0")}</dd></div>}
        </dl>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg" className="h-11">
          <Link href={`/dashboard/ventas/${sale.id}/boleta`}>
            <FileText aria-hidden="true" /> Ver boleta
          </Link>
        </Button>
        {canCancel && <CancelSaleDialog saleId={sale.id} number={sale.number} units={sale.unitCount} />}
      </div>

      <section aria-labelledby="mov-title" className="grid gap-2">
        <h2 id="mov-title" className="font-extrabold">Movimientos de inventario</h2>
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card text-sm shadow-sm">
          {sale.movements.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="font-semibold">{MOVEMENT_LABELS[m.type]} · {m.product.name}</p>
                <p className="text-xs text-muted-foreground">{variantLabel(m.variant)} · {formatDateTime(m.createdAt)} · {m.user}</p>
              </div>
              <span className="text-xs whitespace-nowrap text-muted-foreground">
                {m.stockBefore} → <b className="text-foreground">{m.stockAfter}</b>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
