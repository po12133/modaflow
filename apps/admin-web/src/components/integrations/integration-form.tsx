"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { cn } from "@modaflow/ui/lib/utils";
import { resetIntegrationAction, saveIntegrationAction, testIntegrationAction } from "@/actions/integrations";
import { dialogField } from "@/components/action-dialog";
import { INTEGRATION_SECTIONS } from "@/config/integrations";
import type { IntegrationSection, SectionState } from "@/types/integrations";
import { PlainField, SecretField } from "./integration-fields";

type Intent = "save" | "test" | "reset";
const SAVED: Record<Intent, string> = {
  save: "Guardado. Las dos APIs usan la configuración nueva en menos de 15 segundos.",
  reset: "Listo: esta sección vuelve a usar las variables de entorno.",
  test: "",
};

export function IntegrationForm({ section, state, version, canEdit, encryptionReady }: { section: IntegrationSection; state: SectionState; version: string; canEdit: boolean; encryptionReady: boolean }) {
  const def = INTEGRATION_SECTIONS[section];
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [running, setRunning] = useState<Intent | null>(null);

  function run(intent: Intent) {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    if (intent === "reset" && !window.confirm("¿Quitar del panel todos los valores de esta sección y volver a las variables de entorno?")) return;
    const data = new FormData(form);
    setMessage(null);
    setRunning(intent);
    start(async () => {
      if (intent === "test") {
        const res = await testIntegrationAction(section, data);
        setMessage(res.ok ? { ok: res.data.ok, text: res.data.message } : { ok: false, text: res.message });
      } else {
        const res = await (intent === "save" ? saveIntegrationAction : resetIntegrationAction)(section, data);
        setMessage(res.ok ? { ok: true, text: SAVED[intent] } : { ok: false, text: res.message });
        if (res.ok) form.reset();
      }
      setRunning(null);
    });
  }

  const button = (intent: Intent, label: string, style: string) => (
    <button type="button" disabled={pending} onClick={() => run(intent)} className={cn("inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-60", style)}>
      {running === intent && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {label}
    </button>
  );

  return (
    <form ref={formRef} onSubmit={(e) => { e.preventDefault(); run("save"); }} className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm">
      <header className="grid gap-1">
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
          {def.title}
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", state.active ? "bg-mint/15 text-[#0b7a66]" : "bg-amber/15 text-[#8a5a00]")}>{state.active ? "En uso" : "Desactivado"}</span>
        </h2>
        <p className="text-sm text-muted-foreground">{def.description}</p>
      </header>
      <fieldset key={version} disabled={!canEdit || pending} className="grid gap-3 sm:grid-cols-2">
        {def.fields.map((f) => <PlainField key={f.name} def={f} state={state.fields[f.name]!} />)}
        {def.secrets.map((s) => <SecretField key={s.name} name={s.name} label={s.label} help={s.help} state={state.secrets[s.name]!} disabled={!encryptionReady} />)}
      </fieldset>
      {canEdit ? (
        <div className="grid gap-3 border-t pt-4">
          <label className="grid gap-1 text-sm font-semibold sm:max-w-sm">
            Tu contraseña actual (confirmación)
            <input name="currentPassword" type="password" required autoComplete="current-password" maxLength={128} className={dialogField} />
          </label>
          <div className="flex flex-wrap gap-2">
            {button("test", "Probar conexión", "border bg-card")}
            {button("save", "Guardar", "bg-primary text-white")}
            {button("reset", "Volver a variables de entorno", "border border-destructive/30 text-destructive")}
          </div>
          <p className="text-xs text-muted-foreground">Los campos vacíos usan la variable de entorno. Las llaves se guardan cifradas, no se vuelven a mostrar y cada cambio queda en la auditoría sin su valor. Probar no guarda nada.</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Tu rol de soporte solo permite consultar esta configuración.</p>
      )}
      {message && (
        <p role="status" className={cn("flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold", message.ok ? "bg-mint/10 text-[#0b7a66]" : "bg-destructive/10 text-destructive")}>
          {message.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          {message.text}
        </p>
      )}
    </form>
  );
}
