import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { RequestActions } from "@/components/catalog-admin/request-actions";
import { RequestStatusBadge } from "@/components/catalog-admin/request-list";
import { ApiError } from "@/lib/api";
import { formatDateTime, formatMoney, variantLabel } from "@/lib/format";
import { getOrderRequest } from "@/services/catalog";

export const metadata: Metadata = { title: "Solicitud del catálogo" };

export const instant = false;

export default async function RequestPage({ params }: PageProps<"/dashboard/catalogo/solicitudes/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const request = await getOrderRequest(id).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <div className="grid gap-4">
      <Link href="/dashboard/catalogo/solicitudes" className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold text-primary">
        <ChevronLeft className="size-4" aria-hidden="true" /> Solicitudes
      </Link>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-extrabold">{request.code}</h1>
        <RequestStatusBadge status={request.status} />
      </header>
      <p className="text-sm text-muted-foreground">
        Creada el {formatDateTime(request.createdAt)}
        {request.whatsappOpenedAt ? ` · el comprador abrió WhatsApp el ${formatDateTime(request.whatsappOpenedAt)} (no confirma que el mensaje llegó)` : ""}
      </p>
      <section aria-label="Prendas" className="rounded-2xl border bg-card p-4 shadow-sm">
        <ul className="divide-y">
          {request.items.map((i) => (
            <li key={`${i.sku}-${i.productId}`} className="flex justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0">
                <Link href={`/dashboard/productos/${i.productId}`} className="font-bold hover:text-primary">{i.productName}</Link>
                <span className="block text-xs text-muted-foreground">{variantLabel(i)} · <span className="font-mono">{i.sku}</span> · {i.quantity} × {formatMoney(i.unitPrice)}</span>
              </span>
              <b className="whitespace-nowrap">{formatMoney(i.lineTotal)}</b>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex justify-between border-t pt-3 text-lg font-extrabold">
          <span>Total referencial</span>
          <span>{formatMoney(request.total)}</span>
        </p>
      </section>
      <RequestActions id={request.id} status={request.status} />
      <p className="text-xs text-muted-foreground">Cuando la compra se concrete, regístrala desde el punto de venta para descontar el stock.</p>
    </div>
  );
}
