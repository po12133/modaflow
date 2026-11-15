"use client";

import { useActionState } from "react";
import { updateCatalogSettingsAction } from "@/actions/catalog";
import { Field, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/form";
import type { FormState } from "@/lib/types";
import type { CatalogSettings } from "@/types/catalog";
import { SlugField } from "./slug-field";

const select = "h-11 w-full rounded-xl border border-input bg-card px-3 text-base md:text-sm";

function ColorInput({ name, label, value, state }: { name: string; label: string; value: string; state: FormState }) {
  return (
    <Field label={label} name={name} state={state}>
      {(a11y) => <input {...a11y} type="color" name={name} defaultValue={value} className="h-11 w-full cursor-pointer rounded-xl border border-input bg-card p-1" />}
    </Field>
  );
}

export function SettingsForm({ settings, origin, disabled }: { settings: CatalogSettings; origin: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateCatalogSettingsAction, {});
  const v = (key: keyof CatalogSettings) => state.values?.[key] ?? String(settings[key] ?? "");

  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <fieldset disabled={disabled} className="grid gap-4 disabled:opacity-60">
        <TextField label="Nombre visible" name="name" defaultValue={v("name")} maxLength={80} required state={state} />
        <SlugField defaultValue={settings.slug} origin={origin} state={state} />
        <TextAreaField label="Descripción" name="description" optional defaultValue={v("description")} maxLength={280} state={state} />
        <TextField label="WhatsApp de la tienda" name="whatsapp" defaultValue={v("whatsapp")} inputMode="tel" state={state} hint="Aquí llegarán los pedidos del catálogo." />
        <div className="grid grid-cols-2 gap-3">
          <ColorInput name="primaryColor" label="Color principal" value={v("primaryColor")} state={state} />
          <ColorInput name="secondaryColor" label="Color secundario" value={v("secondaryColor")} state={state} />
        </div>
        <TextAreaField
          label="Mensaje predeterminado"
          name="welcomeMessage"
          optional
          defaultValue={v("welcomeMessage")}
          maxLength={300}
          state={state}
          hint={`Encabeza el pedido por WhatsApp. Si lo dejas vacío: "Hola, quiero consultar por estas prendas de ${settings.name}:"`}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prendas agotadas" name="outOfStock" state={state}>
            {(a11y) => (
              <select {...a11y} name="outOfStock" defaultValue={v("outOfStock")} className={select}>
                <option value="SHOW">Mostrar como agotadas</option>
                <option value="HIDE">Ocultar automáticamente</option>
              </select>
            )}
          </Field>
          <Field label="Estado del catálogo" name="status" state={state}>
            {(a11y) => (
              <select {...a11y} name="status" defaultValue={v("status")} className={select}>
                <option value="PUBLISHED">Publicado</option>
                <option value="HIDDEN">Oculto temporalmente</option>
              </select>
            )}
          </Field>
        </div>
        <SubmitButton pending={pending} className="justify-self-start">
          Guardar cambios
        </SubmitButton>
      </fieldset>
    </form>
  );
}
