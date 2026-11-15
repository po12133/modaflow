import type { SaleStatus } from "@/lib/types";
import { cn } from "@modaflow/ui/lib/utils";

export function SaleStatusBadge({ status, className }: { status: SaleStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap",
        status === "COMPLETED" ? "bg-mint/15 text-[#0b7a66]" : "bg-destructive/10 text-destructive",
        className,
      )}
    >
      {status === "COMPLETED" ? "Completada" : "Anulada"}
    </span>
  );
}
