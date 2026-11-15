"use client";

import { Check, ImageOff } from "lucide-react";
import { useActionState, useState } from "react";
import { Field, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/form";
import type { FormState, Store } from "@/lib/types";
import { STORE_TIMEZONES } from "@/lib/validation";
import { cn } from "@/lib/utils";

const COLOR_PRESETS = [
  { value: "#6C4CF5", name: "Violeta" },
  { value: "#FF5C8A", name: "Rosa" },
  { value: "#B04CF0", name: "Orquídea" },
  { value: "#12A88F", name: "Menta" },
  { value: "#2F7CF6", name: "Azul" },
  { value: "#E8970C", name: "Ámbar" },
  { value: "#E0444B", name: "Rojo" },
  { value: "#16132B", name: "Noche" },
];

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

interface StoreFormProps {
  action: Action;
  store?: Pick<Store, "name" | "description" | "whatsapp" | "city" | "address" | "primaryColor"> & { timezone?: string };
  submitLabel: string;
  pendingText?: string;
}

export function StoreForm({ action, store, submitLabel, pendingText }: StoreFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [color, setColor] = useState((state.values?.primaryColor ?? store?.primaryColor ?? "#6C4CF5").toUpperCase());

  return (
    <form action={formAction} className="grid gap-5">
      <FormMessage state={state} />

      <TextField
        label="Nombre comercial"
        name="name"
        defaultValue={store?.name}
        autoComplete="organization"
        minLength={2}
        maxLength={80}
        placeholder="Ej. MioShop"
        state={state}
      />
      <TextAreaField
        label="Descripción breve"
        name="description"
        optional
        defaultValue={store?.description ?? ""}
        maxLength={280}
        placeholder="Ej. Moda femenina, blusas y vestidos"
        hint="Máximo 280 caracteres."
        state={state}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="WhatsApp"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={store?.whatsapp}
          placeholder="71234567"
          maxLength={20}
          hint="Número de Bolivia (8 dígitos) o con código de país."
          state={state}
        />
        <TextField
          label="Ciudad"
          name="city"
          defaultValue={store?.city}
          autoComplete="address-level2"
          minLength={2}
          maxLength={80}
          placeholder="Ej. Cochabamba"
          state={state}
        />
      </div>

      <TextField
        label="Dirección"
        name="address"
        optional
        defaultValue={store?.address ?? ""}
        autoComplete="street-address"
        maxLength={200}
        placeholder="Ej. Av. Heroínas 123"
        state={state}
      />

      {store?.timezone && (
        <Field label="Zona horaria" name="timezone" state={state} hint="Define el inicio y fin de cada día en tus reportes.">
          {(a11y) => (
            <select
              {...a11y}
              name="timezone"
              defaultValue={state.values?.timezone ?? store.timezone}
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-base md:text-sm"
            >
              {STORE_TIMEZONES.map(([tz, label]) => (
                <option key={tz} value={tz}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      <Field label="Color principal" name="primaryColor" state={state} hint="Se usará en tu catálogo y documentos.">
        {(a11y) => (
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Colores sugeridos">
            {COLOR_PRESETS.map((preset) => {
              const selected = color === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={preset.name}
                  title={preset.name}
                  onClick={() => setColor(preset.value)}
                  className={cn(
                    "grid size-10 place-items-center rounded-full ring-offset-2 transition-transform active:scale-95",
                    selected ? "ring-2 ring-foreground" : "ring-1 ring-black/10",
                  )}
                  style={{ backgroundColor: preset.value }}
                >
                  {selected && <Check className="size-4 text-white drop-shadow" aria-hidden="true" />}
                </button>
              );
            })}
            <label className="relative grid size-10 cursor-pointer place-items-center overflow-hidden rounded-full ring-1 ring-black/10">
              <span className="sr-only">Elegir otro color</span>
              <span aria-hidden="true" className="absolute inset-0 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" />
              <input
                type="color"
                value={color.toLowerCase()}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
                {...a11y}
              />
            </label>
            <span className="ml-1 inline-flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 font-mono text-xs font-semibold">
              <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: color }} />
              {color}
            </span>
            <input type="hidden" name="primaryColor" value={color} />
          </div>
        )}
      </Field>

      <div className="flex items-center gap-3 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
          <ImageOff className="size-5" aria-hidden="true" />
        </span>
        <p>
          <span className="font-semibold text-ink-2">Logotipo:</span> podrás subirlo cuando habilitemos el
          almacenamiento de imágenes.
        </p>
      </div>

      <SubmitButton pending={pending} pendingText={pendingText} className="w-full sm:w-auto sm:justify-self-end">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
