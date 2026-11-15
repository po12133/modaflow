import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatChange } from "@/lib/reports";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  change,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  change?: number | null;
  hint?: ReactNode;
  tone?: "default" | "primary";
}) {
  const text = change === undefined ? null : formatChange(change);
  return (
    <div className={cn("grid min-w-0 content-start gap-1 rounded-2xl border bg-card p-3.5 shadow-sm", tone === "primary" && "border-primary/30 bg-secondary/40")}>
      <p className="line-clamp-2 text-xs leading-tight font-semibold text-muted-foreground">{label}</p>
      <p className="truncate text-xl leading-tight font-extrabold sm:text-2xl">{value}</p>
      {change !== undefined && (
        <p
          className={cn(
            "flex items-center gap-1 text-xs font-bold",
            change === null ? "font-semibold text-muted-foreground" : change > 0 ? "text-[#0b7a66]" : change < 0 ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {change === null ? null : change > 0 ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : change < 0 ? <ArrowDownRight className="size-3.5" aria-hidden="true" /> : <Minus className="size-3.5" aria-hidden="true" />}
          {text ?? "Sin base de comparación"}
        </p>
      )}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
