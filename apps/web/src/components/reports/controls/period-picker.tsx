"use client";

import { CalendarRange } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { REPORT_PERIODS } from "@/config/reports";
import { chip, useUrlUpdate } from "@/hooks/use-url-update";

export function PeriodPicker({ period, from, to }: { period: string; from: string; to: string }) {
  const { update, pending } = useUrlUpdate();
  const [custom, setCustom] = useState(period === "custom");
  const [range, setRange] = useState({ from, to });
  const [error, setError] = useState<string | null>(null);

  function applyCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!range.from || !range.to) return setError("Elige la fecha inicial y la final.");
    if (range.from > range.to) return setError("La fecha inicial no puede ser posterior a la fecha final.");
    setError(null);
    update({ period: "custom", from: range.from, to: range.to });
  }

  return (
    <div className="grid gap-2" aria-busy={pending}>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label="Periodo">
        {REPORT_PERIODS.map(([value, label]) => {
          const on = value === "custom" ? custom : !custom && period === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => {
                if (value === "custom") return setCustom(true);
                setCustom(false);
                update({ period: value, from: undefined, to: undefined });
              }}
              className={chip(on)}
            >
              {value === "custom" && <CalendarRange className="mr-1 inline size-4 align-[-3px]" aria-hidden="true" />}
              {label}
            </button>
          );
        })}
      </div>
      {custom && (
        <form onSubmit={applyCustom} noValidate className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-xs font-semibold text-ink-2">
            Desde
            <Input type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="h-11 bg-card text-base md:text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-ink-2">
            Hasta
            <Input type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="h-11 bg-card text-base md:text-sm" />
          </label>
          <button type="submit" className="col-span-2 h-11 rounded-xl bg-primary px-4 text-sm font-bold text-white sm:col-span-1">
            Aplicar
          </button>
          {error && (
            <p role="alert" className="col-span-2 text-sm font-semibold text-destructive sm:col-span-3">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
