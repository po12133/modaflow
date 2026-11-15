"use server";

import type { ActionResult } from "@modaflow/ui/types/actions";
import { mutate } from "@/lib/actions";
import { integrationBody } from "@/lib/integration-form";
import type { IntegrationSection, IntegrationTestResult } from "@/types/integrations";

const SECTIONS: IntegrationSection[] = ["storage", "ai", "email"];

function guard(section: IntegrationSection, form: FormData): { ok: false; message: string } | null {
  if (!SECTIONS.includes(section)) return { ok: false, message: "Integración desconocida." };
  if (!String(form.get("currentPassword") ?? "")) return { ok: false, message: "Escribe tu contraseña actual para confirmar." };
  return null;
}

export async function saveIntegrationAction(section: IntegrationSection, form: FormData): Promise<ActionResult<null>> {
  const invalid = guard(section, form);
  if (invalid) return invalid;
  const res = await mutate(`/admin/integrations/${section}`, "PATCH", integrationBody(section, form));
  return res.ok ? { ok: true, data: null } : res;
}

export async function testIntegrationAction(section: IntegrationSection, form: FormData): Promise<ActionResult<IntegrationTestResult>> {
  const invalid = guard(section, form);
  if (invalid) return invalid;
  return mutate<IntegrationTestResult>(`/admin/integrations/${section}/test`, "POST", integrationBody(section, form));
}

export async function resetIntegrationAction(section: IntegrationSection, form: FormData): Promise<ActionResult<null>> {
  const invalid = guard(section, form);
  if (invalid) return invalid;
  const res = await mutate(`/admin/integrations/${section}/reset`, "POST", { currentPassword: String(form.get("currentPassword")) });
  return res.ok ? { ok: true, data: null } : res;
}
