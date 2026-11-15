import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Usage bar (as in the prototype sidebar): gradient, amber from 80 %, red when full. */
export function UsageMeter({
  label,
  used,
  limit,
  detail,
  className,
  capacity = false,
}: {
  label: string;
  used: number;
  limit: number;
  detail?: string;
  className?: string;
  /** Seats-like limits (users, branches): being at the limit is normal, not a warning. */
  capacity?: boolean;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = capacity
    ? "bg-brand-gradient"
    : pct >= 100
      ? "bg-destructive"
      : pct >= 80
        ? "bg-amber"
        : "bg-brand-gradient";
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs font-semibold text-muted-foreground">
        <span>{label}</span>
        <span>
          <b className="text-ink-2">{formatNumber(used)}</b> / {formatNumber(limit)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      {detail && <p className="text-[0.7rem] text-muted-foreground">{detail}</p>}
    </div>
  );
}
