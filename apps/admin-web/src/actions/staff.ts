"use server";

import { z } from "zod";
import type { ActionResult } from "@modaflow/ui/types/actions";
import { check, mutate, reason, text, uuid } from "@/lib/actions";
import type { StaffRole } from "@/types/admin";
import type { SetupLink } from "@/types/staff";

const role = z.enum(["SUPERADMIN", "SUPPORT"]);
const inviteSchema = z.object({
  name: z.string().trim().min(2, { error: "Escribe el nombre completo." }).max(120),
  email: z.string().trim().toLowerCase().email({ error: "Ingresa un correo válido." }).max(254),
  role,
});

export async function inviteStaffAction(form: FormData): Promise<ActionResult<SetupLink & { email: string }>> {
  const v = check(inviteSchema, { name: text(form, "name"), email: text(form, "email"), role: text(form, "role") });
  if (!v.ok) return v;
  const res = await mutate<{ setupUrl: string; expiresAt: string; staff: { email: string } }>("/admin/staff", "POST", v.data);
  return res.ok ? { ok: true, data: { setupUrl: res.data.setupUrl, expiresAt: res.data.expiresAt, email: res.data.staff.email } } : res;
}

export async function staffSetupLinkAction(id: string): Promise<ActionResult<SetupLink>> {
  const v = check(uuid, id);
  return v.ok ? mutate<SetupLink>(`/admin/staff/${id}/setup-link`, "POST", {}) : v;
}

export async function staffRoleAction(id: string, next: StaffRole, form: FormData): Promise<ActionResult<null>> {
  const v = check(z.object({ id: uuid, role, reason }), { id, role: next, reason: text(form, "reason") });
  if (!v.ok) return v;
  const res = await mutate(`/admin/staff/${id}`, "PATCH", { role: v.data.role, reason: v.data.reason });
  return res.ok ? { ok: true, data: null } : res;
}

export async function staffStatusAction(id: string, status: "ACTIVE" | "DISABLED", form: FormData): Promise<ActionResult<null>> {
  const v = check(z.object({ id: uuid, reason }), { id, reason: text(form, "reason") });
  if (!v.ok) return v;
  const res = await mutate(`/admin/staff/${id}`, "PATCH", { status, reason: v.data.reason });
  return res.ok ? { ok: true, data: null } : res;
}
