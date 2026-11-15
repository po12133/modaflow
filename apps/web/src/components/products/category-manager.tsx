"use client";

import { Check, LoaderCircle, Pencil, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { createCategoryAction, renameCategoryAction } from "@/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category } from "@/lib/types";

export function CategoryManager({ categories, canEdit, canCreate }: { categories: Category[]; canEdit: boolean; canCreate: boolean }) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCategoryAction(name);
      if (!result.ok) setError(result.fieldErrors ? Object.values(result.fieldErrors)[0]![0]! : result.message);
      else setName("");
    });
  }

  function rename(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await renameCategoryAction(id, editName);
      if (!result.ok) setError(result.fieldErrors ? Object.values(result.fieldErrors)[0]![0]! : result.message);
      else setEditing(null);
    });
  }

  return (
    <div className="grid gap-4">
      {canCreate && (
        <form onSubmit={create} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva categoría" maxLength={60} aria-label="Nueva categoría" className="h-11 bg-card text-base md:text-sm" />
          <Button type="submit" size="lg" className="h-11" disabled={pending || name.trim().length < 2}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />} Agregar
          </Button>
        </form>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
        {categories.map((c) => (
          <li key={c.id} className="flex min-h-14 items-center gap-2 px-3.5 py-2">
            {editing === c.id ? (
              <>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} aria-label={`Nuevo nombre para ${c.name}`} className="h-10 flex-1 text-base md:text-sm" autoFocus />
                <button type="button" onClick={() => rename(c.id)} disabled={pending} className="grid size-10 place-items-center rounded-lg text-primary" aria-label="Guardar nombre">
                  <Check className="size-5" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setEditing(null)} className="grid size-10 place-items-center rounded-lg text-muted-foreground" aria-label="Cancelar">
                  <X className="size-5" aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 font-semibold">{c.name}</span>
                <span className="text-sm text-muted-foreground">
                  {c.productCount} {c.productCount === 1 ? "producto" : "productos"}
                </span>
                {canEdit && (
                  <button type="button" onClick={() => { setEditing(c.id); setEditName(c.name); setError(null); }} className="grid size-10 place-items-center rounded-lg text-muted-foreground hover:text-primary" aria-label={`Renombrar ${c.name}`}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
