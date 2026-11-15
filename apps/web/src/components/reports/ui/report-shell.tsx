import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { periodRangeText } from "@/lib/reports";
import { toQuery } from "@modaflow/ui/lib/query";
import { cn } from "@modaflow/ui/lib/utils";
import type { PeriodParams, ReportPeriodView } from "@/types/reports";
import { PeriodPicker } from "@modaflow/ui/components/period-picker";
import { ExportButtons } from "./export-buttons";

const TABS = [
  ["", "Resumen"],
  ["/ventas", "Ventas"],
  ["/productos", "Productos"],
  ["/inventario", "Inventario"],
] as const;

export function ReportShell({
  title,
  store,
  period,
  periodQuery,
  exportQuery,
  tab,
  advanced,
  children,
}: {
  title: string;
  store: string;
  period: ReportPeriodView;
  periodQuery: PeriodParams;
  exportQuery: Record<string, string | undefined>;
  tab: (typeof TABS)[number][0];
  advanced: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{store}</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink-2">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            {period.label} · {periodRangeText(period)}
          </p>
        </div>
        <ExportButtons query={exportQuery} advanced={advanced} />
      </header>
      <PeriodPicker period={period.key} from={period.from} to={period.to} />
      <nav aria-label="Vistas de reportes" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex min-w-max gap-1 rounded-xl bg-muted p-1">
          {TABS.map(([path, label]) => (
            <li key={path}>
              <Link
                href={`/dashboard/reportes${path}${toQuery({ ...periodQuery })}`}
                aria-current={tab === path ? "page" : undefined}
                className={cn("block rounded-lg px-3.5 py-2 text-sm font-bold", tab === path ? "bg-white text-violet-strong shadow-sm" : "text-ink-2")}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}
