import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_TONES } from "@/config/catalog";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderRequestRow, RequestStatus } from "@/types/catalog";

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap", REQUEST_STATUS_TONES[status])}>{REQUEST_STATUS_LABELS[status]}</span>;
}

export function RequestList({ items }: { items: OrderRequestRow[] }) {
  if (items.length === 0) {
    return <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Todavía no hay solicitudes desde tu catálogo.</p>;
  }
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
      {items.map((r) => (
        <li key={r.id}>
          <Link href={`/dashboard/catalogo/solicitudes/${r.id}`} className="flex items-center gap-3 p-3.5 hover:bg-muted/40">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <b className="font-mono">{r.code}</b>
                <RequestStatusBadge status={r.status} />
              </span>
              <span className="block truncate text-xs text-muted-foreground">{r.preview.join(", ")}{r.itemCount > r.preview.length ? "…" : ""}</span>
              <span className="block text-xs text-muted-foreground">{formatDateTime(r.createdAt)} · {r.unitCount} {r.unitCount === 1 ? "prenda" : "prendas"}</span>
            </span>
            <b className="whitespace-nowrap">{formatMoney(r.total)}</b>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
