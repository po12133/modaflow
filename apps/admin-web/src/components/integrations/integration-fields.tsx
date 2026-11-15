import { cn } from "@modaflow/ui/lib/utils";
import { dialogField } from "@/components/action-dialog";
import { SOURCE_LABELS } from "@/config/integrations";
import type { FieldDef, FieldSource, PlainFieldState, SecretFieldState } from "@/types/integrations";

const TONES: Record<FieldSource, string> = { panel: "bg-primary/10 text-violet-strong", env: "bg-muted text-ink-2", none: "bg-amber/15 text-[#8a5a00]" };

export function SourceBadge({ source }: { source: FieldSource }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[0.7rem] font-bold whitespace-nowrap", TONES[source])}>{SOURCE_LABELS[source]}</span>;
}

function Label({ text, source, help, children }: { text: string; source: FieldSource; help?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      <span className="flex flex-wrap items-center gap-2">{text}<SourceBadge source={source} /></span>
      {children}
      {help && <span className="text-xs font-normal text-muted-foreground">{help}</span>}
    </label>
  );
}

const envText = (v: PlainFieldState["envValue"]) => (v === null || v === "" ? null : typeof v === "boolean" ? (v ? "Sí" : "No") : String(v));

export function PlainField({ def, state }: { def: FieldDef; state: PlainFieldState }) {
  const fromEnv = envText(state.envValue);
  if (def.kind === "boolean") {
    const value = state.value === null ? "" : String(state.value);
    return (
      <Label text={def.label} source={state.source} help={def.help}>
        <select name={def.name} defaultValue={value} className={dialogField}>
          <option value="">{fromEnv ? `Usar variable de entorno (${fromEnv})` : "Usar variable de entorno"}</option>
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
      </Label>
    );
  }
  return (
    <Label text={def.label} source={state.source} help={def.help}>
      <input
        name={def.name}
        type={def.kind === "number" ? "number" : "text"}
        defaultValue={state.value === null ? "" : String(state.value)}
        placeholder={fromEnv ? `Variable de entorno: ${fromEnv}` : def.placeholder}
        autoComplete="off"
        spellCheck={false}
        className={dialogField}
      />
    </Label>
  );
}

function secretPlaceholder(s: SecretFieldState): string {
  if (s.source === "panel") return s.hint ? `Guardada en el panel · termina en ${s.hint}` : "Guardada en el panel";
  if (s.source === "env") return "Usando la variable de entorno";
  return "Sin configurar";
}

export function SecretField({ name, label, help, state, disabled }: { name: string; label: string; help?: string; state: SecretFieldState; disabled: boolean }) {
  return (
    <Label text={label} source={state.source} help={help}>
      <input name={name} type="password" autoComplete="new-password" spellCheck={false} disabled={disabled} placeholder={secretPlaceholder(state)} className={dialogField} />
      {state.unreadable && <span role="alert" className="text-xs font-semibold text-destructive">No se puede leer la llave guardada (¿cambió SETTINGS_ENCRYPTION_KEY?). Vuelve a ingresarla.</span>}
      {state.source === "panel" && (
        <span className="flex items-center gap-2 text-xs font-normal">
          <input type="checkbox" name={`clear:${name}`} className="size-4 accent-[#6c4cf5]" />
          Quitar del panel y usar la variable de entorno
        </span>
      )}
    </Label>
  );
}
