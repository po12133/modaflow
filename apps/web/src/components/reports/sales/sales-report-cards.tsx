import Link from "next/link";
import { SaleStatusBadge } from "@/components/sales/sale-status-badge";
import { formatDateTime, formatMoney, PAYMENT_LABELS, plural } from "@modaflow/ui/lib/format";
import type { SalesReportRow } from "@/types/reports";

export function SalesReportCards({ items }: { items: SalesReportRow[] }) {
  return (
    <ul className="grid gap-2 md:hidden">
      {items.map((s) => (
        <li key={s.id}>
          <Link href={`/dashboard/ventas/${s.id}`} className="grid gap-1 rounded-2xl border bg-card p-3.5 shadow-sm">
            <span className="flex items-center justify-between gap-2">
              <b>{s.number}</b>
              <b className={s.status === "CANCELED" ? "text-muted-foreground line-through" : ""}>{formatMoney(s.total)}</b>
            </span>
            <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">
                {formatDateTime(s.createdAt)} · {plural(s.units, "prenda")} · {PAYMENT_LABELS[s.paymentMethod]}
              </span>
              {s.status === "CANCELED" && <SaleStatusBadge status={s.status} />}
            </span>
            <span className="text-xs text-muted-foreground">
              Subtotal {formatMoney(s.subtotal)} · desc. {formatMoney(s.discounts)} · {s.seller}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
