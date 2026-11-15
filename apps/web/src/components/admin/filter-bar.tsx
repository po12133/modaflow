import type { ReactNode } from "react";

export const filterField = "h-10 min-w-0 rounded-xl border border-input bg-card px-2.5 text-base md:text-sm";

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <form method="get" role="search" className="grid grid-cols-2 gap-2 rounded-2xl border bg-card p-3 sm:flex sm:flex-wrap sm:items-end">
      {children}
      <button type="submit" className="col-span-2 h-10 rounded-xl bg-primary px-4 text-sm font-bold text-white sm:col-span-1">
        Filtrar
      </button>
    </form>
  );
}

export function FilterField({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`grid gap-1 text-xs font-semibold text-ink-2 ${wide ? "col-span-2 sm:min-w-64" : ""}`}>
      {label}
      {children}
    </label>
  );
}
