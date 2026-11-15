"use client";

import Link from "next/link";
import { ImageOff } from "lucide-react";
import { useState, useTransition } from "react";
import { bulkPublishAction } from "@/actions/catalog";
import { formatMoney } from "@modaflow/ui/lib/format";
import type { CatalogProductRow } from "@/types/catalog";
import { PublishToggle } from "./publish-toggle";

export function PublishList({ items, canEdit }: { items: CatalogProductRow[]; canEdit: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const all = items.length > 0 && selected.size === items.length;

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulk(publish: boolean) {
    setMessage(null);
    start(async () => {
      const res = await bulkPublishAction([...selected], publish);
      if (!res.ok) return setMessage(res.message);
      setMessage(`${res.data.updated} ${res.data.updated === 1 ? "producto" : "productos"} ${publish ? "publicados" : "ocultos"}. El inventario no cambió.`);
      setSelected(new Set());
    });
  }

  return (
    <div className="grid gap-3">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={all} onChange={() => setSelected(all ? new Set() : new Set(items.map((i) => i.id)))} className="size-5 accent-[#6c4cf5]" />
            {selected.size ? `${selected.size} seleccionados` : "Seleccionar todos"}
          </label>
          <div className="ml-auto flex gap-2">
            <button type="button" disabled={!selected.size || pending} onClick={() => bulk(true)} className="h-9 rounded-xl bg-primary px-3 text-sm font-bold text-white disabled:opacity-50">
              Publicar
            </button>
            <button type="button" disabled={!selected.size || pending} onClick={() => bulk(false)} className="h-9 rounded-xl border bg-card px-3 text-sm font-bold disabled:opacity-50">
              Ocultar
            </button>
          </div>
          {message && <p role="status" className="w-full text-sm font-semibold">{message}</p>}
        </div>
      )}
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
        {items.map((p) => (
          <li key={p.id} className="flex items-center gap-3 p-3">
            {canEdit && <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Seleccionar ${p.name}`} className="size-5 shrink-0 accent-[#6c4cf5]" />}
            {p.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
              <img src={p.thumbUrl} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg bg-muted object-cover" />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <ImageOff className="size-4" aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <Link href={`/dashboard/productos/${p.id}`} className="block truncate font-bold hover:text-primary">
                {p.name}
              </Link>
              <span className="block text-xs text-muted-foreground">
                {formatMoney(p.salePrice)} · {p.totalStock === 0 ? "Agotado" : `${p.totalStock} u.`}
                {p.category ? ` · ${p.category}` : ""}
              </span>
            </span>
            <PublishToggle key={`${p.id}-${p.catalogPublished}`} id={p.id} published={p.catalogPublished} disabled={!canEdit} label={`Mostrar ${p.name} en el catálogo`} />
          </li>
        ))}
      </ul>
    </div>
  );
}
