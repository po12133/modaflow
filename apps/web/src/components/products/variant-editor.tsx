"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface VariantRow {
  key: string;
  size: string;
  color: string;
  quantity: number;
}

export type VariantMode = "single" | "sizes";

const QUICK_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export function newRow(size = "", color = "", quantity = 1): VariantRow {
  return { key: crypto.randomUUID(), size, color, quantity };
}

function QuantityStepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center rounded-xl border bg-card" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="grid size-11 place-items-center text-ink-2" aria-label="Restar una unidad">
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={100000}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Math.min(100000, Math.trunc(Number(e.target.value) || 0))))}
        className="h-11 w-14 bg-transparent text-center text-base font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        aria-label={`${label}: cantidad`}
      />
      <button type="button" onClick={() => onChange(Math.min(100000, value + 1))} className="grid size-11 place-items-center text-ink-2" aria-label="Sumar una unidad">
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Stock by size/color. "Talla única" covers one-off garments (ropa de fardo)
 * with a single quantity; "Varias tallas" builds one row per size/color.
 */
export function VariantEditor({
  mode,
  onModeChange,
  rows,
  onRowsChange,
  error,
}: {
  mode: VariantMode;
  onModeChange: (mode: VariantMode) => void;
  rows: VariantRow[];
  onRowsChange: (rows: VariantRow[]) => void;
  error?: string;
}) {
  const update = (key: string, patch: Partial<VariantRow>) => onRowsChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const sizesPresent = new Set(rows.map((r) => r.size.trim().toUpperCase()));
  const total = rows.reduce((sum, r) => sum + (r.quantity || 0), 0);

  function toggleSize(size: string) {
    if (sizesPresent.has(size)) onRowsChange(rows.filter((r) => r.size.trim().toUpperCase() !== size));
    else onRowsChange([...rows.filter((r) => r.size.trim() !== "" || r.color.trim() !== ""), newRow(size)]);
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Tipo de stock">
        {(
          [
            ["single", "Talla única", "Prenda única o de fardo"],
            ["sizes", "Varias tallas", "Mismo modelo en tallas/colores"],
          ] as const
        ).map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => onModeChange(value)}
            className={cn(
              "rounded-lg px-2 py-2 text-left",
              mode === value ? "bg-white text-violet-strong shadow-sm" : "text-ink-2",
            )}
          >
            <span className="block text-sm font-bold">{label}</span>
            <span className="block text-[0.7rem] text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>

      {mode === "single" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid flex-1 gap-1.5 text-sm font-semibold text-ink-2" htmlFor="single-size">
            Talla <span className="font-normal text-muted-foreground">(opcional)</span>
            <Input
              id="single-size"
              value={rows[0]?.size ?? ""}
              onChange={(e) => update(rows[0]!.key, { size: e.target.value })}
              placeholder="Ej. M o 38"
              maxLength={20}
              className="h-11 text-base md:text-sm"
            />
          </label>
          <div className="grid gap-1.5 text-sm font-semibold text-ink-2">
            Cantidad
            <QuantityStepper value={rows[0]?.quantity ?? 1} onChange={(q) => update(rows[0]!.key, { quantity: q })} label="Talla única" />
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-ink-2">Toca las tallas que tienes</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleSize(size)}
                  aria-pressed={sizesPresent.has(size)}
                  className={cn(
                    "h-10 min-w-12 rounded-xl border px-3 text-sm font-bold",
                    sizesPresent.has(size) ? "border-primary bg-primary text-white" : "bg-card text-ink-2",
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <ul className="grid gap-2">
            {rows.map((row, i) => (
              <li key={row.key} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-xl border bg-card p-2 sm:grid-cols-[8rem_1fr_auto_auto]">
                <Input value={row.size} onChange={(e) => update(row.key, { size: e.target.value })} placeholder="Talla" maxLength={20} aria-label={`Variante ${i + 1}: talla`} className="h-11 text-base md:text-sm" />
                <Input value={row.color} onChange={(e) => update(row.key, { color: e.target.value })} placeholder="Color (opcional)" maxLength={40} aria-label={`Variante ${i + 1}: color`} className="h-11 text-base md:text-sm" />
                <button type="button" onClick={() => onRowsChange(rows.filter((r) => r.key !== row.key))} disabled={rows.length === 1} className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:text-destructive disabled:opacity-30 sm:order-last" aria-label={`Quitar variante ${i + 1}`}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
                <div className="col-span-3 sm:col-span-1">
                  <QuantityStepper value={row.quantity} onChange={(q) => update(row.key, { quantity: q })} label={`Variante ${row.size || i + 1}`} />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onRowsChange([...rows, newRow()])} className="h-10 rounded-xl border bg-card px-3 text-sm font-semibold">
              + Otra talla
            </button>
            {rows.some((r) => r.size.trim()) && (
              <button
                type="button"
                onClick={() => {
                  const sizes = [...new Set(rows.map((r) => r.size.trim()).filter(Boolean))];
                  onRowsChange([...rows, ...sizes.map((s) => newRow(s, "", 1))]);
                }}
                className="h-10 rounded-xl border bg-card px-3 text-sm font-semibold"
              >
                + Mismas tallas en otro color
              </button>
            )}
          </div>
        </>
      )}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Stock inicial: <b className="text-foreground">{total}</b> {total === 1 ? "unidad" : "unidades"}
      </p>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
