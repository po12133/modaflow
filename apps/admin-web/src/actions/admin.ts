"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import type { ActionResult } from "@modaflow/ui/types/actions";

type Result = ActionResult<null>;
const uuid = z.string().uuid();
const reason = z.string().trim().min(5, { error: "Escribe un motivo (mínimo 5 caracteres)." }).max(500);
const text = (f: FormData, k: string) => String(f.get(k) ?? "");

async function mutate(path: string, method: "POST" | "PATCH", body: unknown): Promise<Result> {
  try {
    await api(path, { method, body });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) redirect("/login");
      const field = error.body.errors ? Object.values(error.body.errors)[0]?.[0] : undefined;
      return { ok: false, code: error.code, message: field ?? error.message ?? "No se pudo completar la acción." };
    }
    return { ok: false, message: "No pudimos conectar con el servidor. Intenta de nuevo." };
  }
  refresh();
  return { ok: true, data: null };
}

function check<T>(schema: z.ZodType<T>, value: unknown): { ok: true; data: T } | { ok: false; message: string } {
  const parsed = schema.safeParse(value);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
}

export async function tenantStatusAction(id: string, action: "SUSPEND" | "REACTIVATE", form: FormData): Promise<Result> {
  const v = check(z.object({ id: uuid, reason }), { id, reason: text(form, "reason") });
  return v.ok ? mutate(`/admin/tenants/${id}/status`, "PATCH", { action, reason: v.data.reason }) : v;
}

export async function userStatusAction(id: string, status: "ACTIVE" | "SUSPENDED", form: FormData): Promise<Result> {
  const v = check(z.object({ id: uuid, reason }), { id, reason: text(form, "reason") });
  return v.ok ? mutate(`/admin/users/${id}/status`, "PATCH", { status, reason: v.data.reason }) : v;
}

export async function subscriptionTransitionAction(id: string, kind: "suspend" | "reactivate" | "cancel", form: FormData): Promise<Result> {
  const v = check(z.object({ id: uuid, reason }), { id, reason: text(form, "reason") });
  return v.ok ? mutate(`/admin/subscriptions/${id}/${kind}`, "POST", { reason: v.data.reason }) : v;
}

export async function extendTrialAction(id: string, form: FormData): Promise<Result> {
  const v = check(z.object({ id: uuid, reason, days: z.coerce.number().int().min(1).max(60) }), { id, reason: text(form, "reason"), days: text(form, "days") });
  return v.ok ? mutate(`/admin/subscriptions/${id}/extend-trial`, "POST", { days: v.data.days, reason: v.data.reason }) : v;
}

export async function manualPaymentAction(id: string, form: FormData): Promise<Result> {
  const v = check(z.object({ id: uuid, reason, method: z.enum(["QR", "TRANSFER"]), planCode: z.string().regex(/^[a-z0-9_-]{2,32}$/).optional(), amountVerified: z.literal("on", { error: "Confirma que verificaste el importe recibido." }) }), {
    id,
    reason: text(form, "reason"),
    method: text(form, "method"),
    planCode: text(form, "planCode") || undefined,
    amountVerified: text(form, "amountVerified"),
  });
  if (!v.ok) return v;
  const body = { method: v.data.method, reason: v.data.reason, amountVerified: true, ...(v.data.planCode ? { planCode: v.data.planCode } : {}) };
  return mutate(`/admin/subscriptions/${id}/${v.data.planCode ? "change-plan" : "renew"}`, "POST", body);
}

export async function approvePaymentAction(id: string, form: FormData): Promise<Result> {
  const v = check(z.object({ id: uuid, note: z.string().trim().max(500), amountVerified: z.literal("on", { error: "Confirma que el importe llegó a la cuenta de ModaFlow." }) }), { id, note: text(form, "note"), amountVerified: text(form, "amountVerified") });
  return v.ok ? mutate(`/admin/payments/${id}/approve`, "POST", { amountVerified: true, note: v.data.note || null }) : v;
}

export async function rejectPaymentAction(id: string, form: FormData): Promise<Result> {
  const v = check(z.object({ id: uuid, reason }), { id, reason: text(form, "reason") });
  return v.ok ? mutate(`/admin/payments/${id}/reject`, "POST", { reason: v.data.reason }) : v;
}

export async function updatePlanAction(id: string, form: FormData): Promise<Result> {
  const num = (k: string) => (text(form, k) === "" ? undefined : Number(text(form, k)));
  const bool = (k: string) => form.get(k) === "on";
  const body = {
    name: text(form, "name").trim(),
    tagline: text(form, "tagline").trim(),
    priceCents: num("price") === undefined ? undefined : Math.round(num("price")! * 100),
    maxProducts: num("maxProducts"),
    aiAnalysesLimit: num("aiAnalysesLimit"),
    maxUsers: num("maxUsers"),
    maxBranches: num("maxBranches"),
    sortOrder: num("sortOrder"),
    inventoryAndSales: bool("inventoryAndSales"),
    advancedReports: bool("advancedReports"),
    advancedManagement: bool("advancedManagement"),
    onlineCatalog: text(form, "onlineCatalog"),
    isActive: bool("isActive"),
    isRecommended: bool("isRecommended"),
    highlights: text(form, "highlights").split("\n").map((h) => h.trim()).filter(Boolean),
    reason: text(form, "reason"),
  };
  const v = check(z.object({ reason }), body);
  if (!v.ok || !uuid.safeParse(id).success) return v.ok ? { ok: false, message: "Plan no válido." } : v;
  if (body.priceCents !== undefined && (!Number.isFinite(body.priceCents) || body.priceCents < 0)) return { ok: false, message: "Precio no válido." };
  return mutate(`/admin/plans/${id}`, "PATCH", body);
}

export async function updateSettingsAction(section: string, form: FormData): Promise<Result> {
  const bool = (k: string) => form.get(k) === "on";
  const opt = (k: string) => (form.has(k) ? text(form, k).trim() || null : undefined);
  const int = (k: string) => (form.has(k) ? Number(text(form, k)) : undefined);
  const bodies: Record<string, Record<string, unknown>> = {
    general: { platformName: text(form, "platformName").trim(), contactEmail: opt("contactEmail"), supportWhatsapp: opt("supportWhatsapp"), timezone: text(form, "timezone") },
    subscriptions: { trialDays: int("trialDays"), renewalNoticeDays: int("renewalNoticeDays"), dataRetentionDays: int("dataRetentionDays"), renewalPolicy: opt("renewalPolicy") },
    payments: { qrEnabled: bool("qrEnabled"), transferEnabled: bool("transferEnabled"), accountHolder: opt("accountHolder"), bankName: opt("bankName"), accountNumber: opt("accountNumber"), accountType: opt("accountType"), paymentInstructions: opt("paymentInstructions") },
    notifications: { notificationEmails: text(form, "notificationEmails").split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) },
  };
  const body = bodies[section];
  if (!body) return { ok: false, message: "Sección no válida." };
  return mutate("/admin/settings", "PATCH", Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)));
}

export async function runExpiryAction(): Promise<void> {
  await mutate("/admin/jobs/subscription-expiry", "POST", {});
}

export async function markAdminNotificationReadAction(id: string): Promise<void> {
  if (uuid.safeParse(id).success) await mutate(`/admin/notifications/${id}/read`, "POST", {});
}
