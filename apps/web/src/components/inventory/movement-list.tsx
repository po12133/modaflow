import Link from "next/link";
import { formatDate, variantLabel } from "@modaflow/ui/lib/format";
import type { Movement, MovementType } from "@/lib/types";
import { cn } from "@modaflow/ui/lib/utils";

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  INITIAL: "Entrada inicial",
  STOCK_IN: "Entrada de mercadería",
  MANUAL_OUT: "Salida manual",
  ADJUSTMENT_IN: "Ajuste positivo",
  ADJUSTMENT_OUT: "Ajuste negativo",
  SALE: "Venta",
  SALE_CANCEL: "Anulación de venta",
};

const timeFmt = new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", timeZone: "America/La_Paz" });

/** Movement history rows (mobile-friendly list). */
export function MovementList({ movements, showProduct = true }: { movements: Movement[]; showProduct?: boolean }) {
  if (movements.length === 0) {
    return <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Sin movimientos todavía.</p>;
  }
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
      {movements.map((m) => {
        const increase = m.stockAfter > m.stockBefore;
        return (
          <li key={m.id} className="flex items-start gap-3 px-3.5 py-3">
            <span className={cn("mt-0.5 grid min-w-12 place-items-center rounded-lg px-1.5 py-1 text-sm font-extrabold", increase ? "bg-mint/15 text-[#0b7a66]" : "bg-destructive/10 text-destructive")}>
              {increase ? "+" : "−"}
              {m.quantity}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-bold">{MOVEMENT_LABELS[m.type]}</p>
              {showProduct && (
                <Link href={`/dashboard/productos/${m.product.id}`} className="block truncate text-primary">
                  {m.product.name} · {variantLabel(m.variant)}
                </Link>
              )}
              {!showProduct && <p className="text-muted-foreground">{variantLabel(m.variant)}</p>}
              {(m.reason || m.reference) && (
                <p className="truncate text-muted-foreground">{[m.reason, m.reference && `Ref. ${m.reference}`].filter(Boolean).join(" · ")}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {formatDate(m.createdAt)} {timeFmt.format(new Date(m.createdAt))} · {m.user}
              </p>
            </div>
            <span className="text-right text-xs text-muted-foreground whitespace-nowrap">
              {m.stockBefore} → <b className="text-foreground">{m.stockAfter}</b>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
