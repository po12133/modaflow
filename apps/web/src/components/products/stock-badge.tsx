import type { StockStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<StockStatus, { label: string; className: string }> = {
  in_stock: { label: "Disponible", className: "bg-mint/15 text-[#0b7a66]" },
  low_stock: { label: "Stock bajo", className: "bg-amber/15 text-[#a2620a]" },
  out_of_stock: { label: "Agotado", className: "bg-destructive/10 text-destructive" },
};

export function StockBadge({ status, units, className }: { status: StockStatus; units?: number; className?: string }) {
  const s = STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap", s.className, className)}>
      {units !== undefined && status !== "out_of_stock" ? `${units} ${units === 1 ? "unid." : "unids."}` : s.label}
    </span>
  );
}

export const STOCK_LABELS: Record<StockStatus, string> = {
  in_stock: STYLES.in_stock.label,
  low_stock: STYLES.low_stock.label,
  out_of_stock: STYLES.out_of_stock.label,
};
