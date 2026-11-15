import Link from "next/link";
import { MOVEMENT_LABELS } from "@/components/inventory/movement-list";
import { STOCK_INCREASES } from "@/config/reports";
import { plural } from "@modaflow/ui/lib/format";
import { cn } from "@modaflow/ui/lib/utils";
import type { InventoryReport } from "@/types/reports";
import { Panel } from "@modaflow/ui/components/panel";

const LABELS: Partial<Record<string, string>> = { SALE: "Salidas por ventas", SALE_CANCEL: "Restituciones por anulación" };

export function MovementsPanel({ movements }: { movements: NonNullable<InventoryReport["movements"]> }) {
  return (
    <Panel
      title="Movimientos del periodo"
      action={
        <Link href="/dashboard/inventario/movimientos" className="text-sm font-bold text-primary">
          Ver historial
        </Link>
      }
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {movements.map((m) => {
          const increase = STOCK_INCREASES.has(m.type);
          return (
            <li key={m.type}>
              <Link href={`/dashboard/inventario/movimientos?type=${m.type}`} className="flex items-center gap-3 rounded-xl border p-3 hover:border-ring">
                <span
                  className={cn(
                    "grid min-w-14 place-items-center rounded-lg px-1.5 py-1 text-sm font-extrabold",
                    m.units === 0 ? "bg-muted text-muted-foreground" : increase ? "bg-mint/15 text-[#0b7a66]" : "bg-destructive/10 text-destructive",
                  )}
                >
                  {m.units === 0 ? "0" : `${increase ? "+" : "−"}${m.units}`}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{LABELS[m.type] ?? MOVEMENT_LABELS[m.type]}</span>
                  <span className="block text-xs text-muted-foreground">{plural(m.movements, "movimiento")}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
