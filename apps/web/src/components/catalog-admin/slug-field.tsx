"use client";

import { useState, useTransition } from "react";
import { checkSlugAction } from "@/actions/catalog";
import { Field } from "@modaflow/ui/components/form";
import { Input } from "@modaflow/ui/components/ui/input";
import type { FormState } from "@/lib/types";

export function SlugField({ defaultValue, origin, state }: { defaultValue: string; origin: string; state: FormState }) {
  const [value, setValue] = useState(state.values?.slug ?? defaultValue);
  const [check, setCheck] = useState<{ available: boolean; message: string | null } | null>(null);
  const [pending, start] = useTransition();

  function verify() {
    if (value === defaultValue) return setCheck(null);
    start(async () => setCheck(await checkSlugAction(value)));
  }

  const hint = pending
    ? "Comprobando…"
    : check
      ? check.available
        ? "Disponible."
        : check.message ?? "No disponible."
      : `${origin}/tienda/${value || "tu-tienda"}`;

  return (
    <Field label="Dirección pública" name="slug" state={state} hint={hint}>
      {(a11y) => (
        <div className="flex items-center rounded-xl border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
          <span className="pl-3 text-sm text-muted-foreground">/tienda/</span>
          <Input
            {...a11y}
            name="slug"
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            onBlur={verify}
            minLength={3}
            maxLength={60}
            required
            autoComplete="off"
            className="h-11 border-0 pl-1 text-base shadow-none focus-visible:ring-0 md:text-sm"
          />
        </div>
      )}
    </Field>
  );
}
