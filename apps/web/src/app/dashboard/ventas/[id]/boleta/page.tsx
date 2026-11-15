import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, Plus } from "lucide-react";
import { ReceiptActions } from "@/components/sales/receipt-actions";
import { ReceiptView } from "@/components/sales/receipt-view";
import { Button } from "@modaflow/ui/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { getDashboardContext } from "@/lib/dal";
import { formatMoney } from "@modaflow/ui/lib/format";
import type { Receipt, SaleDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Boleta" };

// Per-request page (reads the session through the API).
export const instant = false;

export default async function ReceiptPage({ params, searchParams }: PageProps<"/dashboard/ventas/[id]/boleta">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let receipt: Receipt;
  let sale: SaleDetail;
  try {
    [receipt, sale] = await Promise.all([api<Receipt>(`/sales/${id}/receipt`), api<SaleDetail>(`/sales/${id}`)]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const { me } = await getDashboardContext();
  const canRevoke = me.membership.role === "OWNER" || me.membership.role === "ADMIN";

  return (
    <div className="mx-auto grid w-full max-w-sm gap-4 print:max-w-none">
      {query.nueva === "1" && (
        <div role="status" className="grid gap-1 rounded-2xl bg-mint/10 p-4 text-[#0b7a66] print:hidden">
          <p className="flex items-center gap-2 text-lg font-extrabold">
            <CircleCheck className="size-6" aria-hidden="true" /> Venta registrada
          </p>
          <p className="text-sm">
            {sale.number} · {formatMoney(sale.total)}. El inventario ya se actualizó.
          </p>
        </div>
      )}
      <ReceiptView receipt={receipt} />
      <ReceiptActions saleId={sale.id} receipt={receipt} initialPath={sale.receiptPath} canRevoke={canRevoke} />
      <div className="grid grid-cols-2 gap-2 print:hidden">
        <Button asChild variant="outline" size="lg" className="h-11">
          <Link href={`/dashboard/ventas/${sale.id}`}>Ver detalle</Link>
        </Button>
        <Button asChild size="lg" className="h-11 font-bold">
          <Link href="/dashboard/ventas/nueva">
            <Plus aria-hidden="true" /> Nueva venta
          </Link>
        </Button>
      </div>
    </div>
  );
}
