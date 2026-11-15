import { INTEGRATION_SECTIONS } from "@/config/integrations";
import type { IntegrationSection } from "@/types/integrations";

export function integrationBody(section: IntegrationSection, form: FormData): Record<string, unknown> {
  const def = INTEGRATION_SECTIONS[section];
  const body: Record<string, unknown> = { currentPassword: String(form.get("currentPassword") ?? "") };
  for (const field of def.fields) {
    const raw = String(form.get(field.name) ?? "").trim();
    if (field.kind === "boolean") body[field.name] = raw === "" ? null : raw === "true";
    else if (field.kind === "number") body[field.name] = raw === "" ? null : Number(raw);
    else body[field.name] = raw === "" ? null : raw;
  }
  for (const secret of def.secrets) {
    const raw = String(form.get(secret.name) ?? "");
    if (form.get(`clear:${secret.name}`) === "on") body[secret.name] = null;
    else if (raw.trim() !== "") body[secret.name] = raw.trim();
  }
  return body;
}
