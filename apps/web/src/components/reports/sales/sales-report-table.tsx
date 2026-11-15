import Link from "next/link";
import { SaleStatusBadge } from "@/components/sales/sale-status-badge";
import { formatDateTime, formatMoney, PAYMENT_LABELS } from "@modaflow/ui/lib/format";
import type { SalesReportRow } from "@/types/reports";

const HEADERS: [string, boolean][] = [
  ["Fecha", false],
  ["N.º", false],
  ["Prendas", true],
  ["Subtotal", true],
  ["Descuentos", true],
  ["Total", true],
  ["Método", false],
  ["Vendedor", false],
  ["Estado", false],
];

export function SalesReportTable({ items }: { items: SalesReportRow[] }) {
  return (
    <div className="relative hidden overflow-x-auto rounded-2xl border bg-card shadow-sm md:block">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>
            {HEADERS.map(([label, right]) => (
              <th key={label} className={right ? "px-3 py-2.5 text-right font-semibold" : "px-3 py-2.5 font-semibold"}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((s) => (
            <tr key={s.id} className="hover:bg-muted/40">
              <td className="px-3 py-2.5 whitespace-nowrap">{formatDateTime(s.createdAt)}</td>
              <td className="px-3 py-2.5 font-bold">
                <Link href={`/dashboard/ventas/${s.id}`} className="text-primary hover:underline">
                  {s.number}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-right">{s.units}</td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatMoney(s.subtotal)}</td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatMoney(s.discounts)}</td>
              <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap">{formatMoney(s.total)}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">{PAYMENT_LABELS[s.paymentMethod]}</td>
              <td className="max-w-40 truncate px-3 py-2.5">{s.seller}</td>
              <td className="px-3 py-2.5">
                <SaleStatusBadge status={s.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
