"use client";

import { SlidersHorizontal, Search } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PUBLIC_SORTS } from "@/config/catalog";
import { useUrlUpdate } from "@/hooks/use-url-update";
import type { PublicCategory } from "@/types/catalog";

export interface CatalogFilterValues {
  search?: string;
  category?: string;
  size?: string;
  color?: string;
  minPrice?: string;
  maxPrice?: string;
  availability?: string;
  sort?: string;
}

const field = "h-11 rounded-xl border border-input bg-white px-3 text-base md:text-sm";

export function CatalogFilters({ values, categories }: { values: CatalogFilterValues; categories: PublicCategory[] }) {
  const { update, pending } = useUrlUpdate();
  const [text, setText] = useState(values.search ?? "");
  const [open, setOpen] = useState(false);
  const active = [values.category, values.size, values.color, values.minPrice, values.maxPrice, values.availability].filter(Boolean).length;

  function applyFilters(form: FormData) {
    const get = (k: string) => String(form.get(k) ?? "").trim() || undefined;
    update({ category: get("category"), size: get("size"), color: get("color"), minPrice: get("minPrice"), maxPrice: get("maxPrice"), availability: form.get("availability") ? "available" : undefined });
    setOpen(false);
  }

  return (
    <div className="grid gap-2" aria-busy={pending}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          update({ search: text.trim() || undefined });
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar prendas, colores, tallas…" aria-label="Buscar prendas" className="h-12 rounded-full bg-white pl-10 text-base" />
      </form>
      <div className="flex gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-full border bg-white px-3.5 text-sm font-semibold">
              <SlidersHorizontal className="size-4" aria-hidden="true" /> Filtros{active ? ` (${active})` : ""}
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Filtrar prendas</DialogTitle>
            </DialogHeader>
            <form action={applyFilters} className="grid gap-3">
              <label className="grid gap-1 text-sm font-semibold">
                Categoría
                <select name="category" defaultValue={values.category ?? ""} className={field}>
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name} ({c.products})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-sm font-semibold">
                  Talla
                  <input name="size" defaultValue={values.size ?? ""} placeholder="M, 38…" maxLength={20} className={field} />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Color
                  <input name="color" defaultValue={values.color ?? ""} placeholder="Rojo…" maxLength={40} className={field} />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Precio desde (Bs)
                  <input name="minPrice" type="number" min={0} inputMode="decimal" defaultValue={values.minPrice ?? ""} className={field} />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Precio hasta (Bs)
                  <input name="maxPrice" type="number" min={0} inputMode="decimal" defaultValue={values.maxPrice ?? ""} className={field} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="availability" defaultChecked={values.availability === "available"} className="size-5 accent-[var(--brand)]" />
                Solo disponibles
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { update({ category: undefined, size: undefined, color: undefined, minPrice: undefined, maxPrice: undefined, availability: undefined }); setOpen(false); }} className="h-11 rounded-xl border text-sm font-bold">
                  Limpiar
                </button>
                <button type="submit" className="h-11 rounded-xl bg-[var(--brand)] text-sm font-bold text-[var(--brand-ink)]">
                  Ver resultados
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <label className="sr-only" htmlFor="catalog-sort">Ordenar</label>
        <select id="catalog-sort" value={values.sort ?? "newest"} onChange={(e) => update({ sort: e.target.value === "newest" ? undefined : e.target.value })} className="h-10 min-w-0 flex-1 rounded-full border bg-white px-3 text-sm font-semibold sm:flex-none">
          {PUBLIC_SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
