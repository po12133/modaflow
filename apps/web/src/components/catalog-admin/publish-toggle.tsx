"use client";

import { useState, useTransition } from "react";
import { setProductPublishedAction } from "@/actions/catalog";
import { cn } from "@modaflow/ui/lib/utils";

export function PublishToggle({ id, published, disabled, label = "Mostrar en catálogo online" }: { id: string; published: boolean; disabled?: boolean; label?: string }) {
  const [value, setValue] = useState(published);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !value;
    setValue(next);
    setError(null);
    start(async () => {
      const res = await setProductPublishedAction(id, next);
      if (!res.ok) {
        setValue(!next);
        setError(res.message);
      }
    });
  }

  return (
    <span className="inline-grid gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={toggle}
        disabled={disabled || pending}
        className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50", value ? "bg-primary" : "bg-muted-foreground/30")}
      >
        <span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition-transform", value ? "translate-x-6" : "translate-x-1")} />
      </button>
      {error && <span role="alert" className="text-xs font-semibold text-destructive">{error}</span>}
    </span>
  );
}
