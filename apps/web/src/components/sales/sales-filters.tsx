"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@modaflow/ui/components/ui/input";
import { PAYMENT_LABELS } from "@modaflow/ui/lib/format";
import { cn } from "@modaflow/ui/lib/utils";

export interface SalesFilterValues {
  period?: string;
  from?: string;
  to?: string;
  status?: string;
  paymentMethod?: string;
  number?: string;
}

const PERIODS = [
  ["all", "Todas"],
  ["today", "Hoy"],
  ["yesterday", "Ayer"],
  ["last7", "Últimos 7 días"],
  ["month", "Este mes"],
  ["custom", "Elegir fechas"],
] as const;

const selectClass = "h-11 rounded-xl border border-input bg-card px-2.5 text-base md:h-10 md:text-sm";

export function SalesFilters({ values }: { values: SalesFilterValues }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [number, setNumber] = useState(values.number ?? "");
  const period = values.period ?? "all";

  function apply(patch: Partial<SalesFilterValues>) {
    const next = { ...values, ...patch };
    if (next.period !== "custom") {
      delete next.from;
      delete next.to;
    }
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && !(k === "period" && v === "all")) qs.set(k, v);
    startTransition(() => router.replace(qs.toString() ? `${pathname}?${qs}` : pathname));
  }

  return (
    <div className="mb-4 grid gap-2" aria-busy={pending}>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" role="group" aria-label="Periodo">
        {PERIODS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => apply({ period: value })}
            aria-pressed={period === value}
            className={cn("h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold", period === value ? "border-foreground bg-foreground text-white" : "bg-card text-ink-2")}
          >
            {label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs font-semibold text-ink-2">
            Desde
            <Input type="date" value={values.from ?? ""} onChange={(e) => apply({ period: "custom", from: e.target.value || undefined })} className="h-11 bg-card text-base md:text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-ink-2">
            Hasta
            <Input type="date" value={values.to ?? ""} onChange={(e) => apply({ period: "custom", to: e.target.value || undefined })} className="h-11 bg-card text-base md:text-sm" />
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
        <form
          className="relative col-span-2 sm:col-span-1"
          onSubmit={(e) => {
            e.preventDefault();
            apply({ number: number.trim() || undefined });
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onBlur={() => number.trim() !== (values.number ?? "") && apply({ number: number.trim() || undefined })}
            placeholder="N.º de venta (ej. V-000012)"
            aria-label="Buscar por número de venta"
            className="h-11 rounded-xl bg-card pl-9 text-base md:h-10 md:text-sm"
          />
        </form>
        <select aria-label="Estado" className={selectClass} value={values.status ?? ""} onChange={(e) => apply({ status: e.target.value || undefined })}>
          <option value="">Todos los estados</option>
          <option value="COMPLETED">Completadas</option>
          <option value="CANCELED">Anuladas</option>
        </select>
        <select aria-label="Método de pago" className={selectClass} value={values.paymentMethod ?? ""} onChange={(e) => apply({ paymentMethod: e.target.value || undefined })}>
          <option value="">Todo método</option>
          {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
