"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface FilterValues {
  search?: string;
  categoryId?: string;
  color?: string;
  size?: string;
  availability?: string;
  sort?: string;
  status?: string;
}

const selectClass = "h-11 w-full rounded-xl border border-input bg-card px-2.5 text-base md:h-10 md:text-sm";

/** Search + filters kept in the URL (server-side filtering and pagination). */
export function ProductFilters({
  values,
  categories,
  showSort = true,
  showStatus = true,
}: {
  values: FilterValues;
  categories?: Category[];
  showSort?: boolean;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(values.search ?? "");
  const [open, setOpen] = useState(Boolean(values.categoryId || values.color || values.size || values.availability || values.status));
  const first = useRef(true);

  function apply(patch: Partial<FilterValues>) {
    const next = { ...values, ...patch };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v);
    startTransition(() => router.replace(qs.toString() ? `${pathname}?${qs}` : pathname));
  }

  // Debounced search while typing.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => apply({ search: search.trim() || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the search text
  }, [search]);

  const activeFilters = [values.categoryId, values.color, values.size, values.availability, values.status === "archived" ? "x" : ""].filter(Boolean).length;

  return (
    <div className="mb-4 grid gap-2" aria-busy={pending}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código o etiqueta"
            aria-label="Buscar productos"
            className="h-11 rounded-xl bg-card pl-9 text-base md:text-sm"
            enterKeyHint="search"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="product-filters"
          className={cn("relative grid h-11 w-12 place-items-center rounded-xl border bg-card", open && "border-primary text-primary")}
          aria-label="Filtros"
        >
          <SlidersHorizontal className="size-5" aria-hidden="true" />
          {activeFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-pink text-[0.65rem] font-bold text-white">{activeFilters}</span>
          )}
        </button>
      </div>

      {open && (
        <div id="product-filters" className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories && (
            <select aria-label="Categoría" className={selectClass} value={values.categoryId ?? ""} onChange={(e) => apply({ categoryId: e.target.value || undefined })}>
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <select aria-label="Disponibilidad" className={selectClass} value={values.availability ?? ""} onChange={(e) => apply({ availability: e.target.value || undefined })}>
            <option value="">Todo el stock</option>
            <option value="in_stock">Con stock</option>
            <option value="low_stock">Stock bajo</option>
            <option value="out_of_stock">Sin stock</option>
          </select>
          <ColorSizeInput label="Color" value={values.color} onCommit={(v) => apply({ color: v })} />
          <ColorSizeInput label="Talla" value={values.size} onCommit={(v) => apply({ size: v })} />
          {showSort && (
            <select aria-label="Ordenar" className={selectClass} value={values.sort ?? "newest"} onChange={(e) => apply({ sort: e.target.value === "newest" ? undefined : e.target.value })}>
              <option value="newest">Más recientes</option>
              <option value="oldest">Más antiguos</option>
              <option value="price_asc">Precio: menor a mayor</option>
              <option value="price_desc">Precio: mayor a menor</option>
              <option value="name">Nombre (A-Z)</option>
            </select>
          )}
          {showStatus && (
            <select aria-label="Estado" className={selectClass} value={values.status ?? "active"} onChange={(e) => apply({ status: e.target.value === "active" ? undefined : e.target.value })}>
              <option value="active">Activos</option>
              <option value="archived">Archivados</option>
            </select>
          )}
          {activeFilters > 0 && (
            <button type="button" onClick={() => apply({ categoryId: undefined, color: undefined, size: undefined, availability: undefined, status: undefined })} className="col-span-2 inline-flex h-10 items-center justify-center gap-1 rounded-xl text-sm font-semibold text-primary sm:col-span-1">
              <X className="size-4" aria-hidden="true" /> Quitar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ColorSizeInput({ label, value, onCommit }: { label: string; value?: string; onCommit: (v: string | undefined) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  return (
    <Input
      aria-label={label}
      placeholder={label}
      value={draft}
      maxLength={label === "Talla" ? 20 : 40}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() !== (value ?? "") && onCommit(draft.trim() || undefined)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(draft.trim() || undefined);
        }
      }}
      className="h-11 rounded-xl bg-card text-base md:h-10 md:text-sm"
    />
  );
}
