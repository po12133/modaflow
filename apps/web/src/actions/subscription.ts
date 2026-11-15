"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { apiFailure, zodFailure } from "@/lib/action-errors";
import { api, ApiError } from "@/lib/api";
import type { FormState } from "@/lib/types";
import { formValues } from "@/lib/validation";

const requestSchema = z.object({
  planCode: z.string().regex(/^[a-z0-9_-]{2,32}$/, { error: "Elige un plan." }),
  note: z
    .string()
    .trim()
    .max(500, { error: "La nota no puede superar 500 caracteres." })
    .transform((v) => (v === "" ? null : v)),
});

/** Requests a plan change. It stays pending: paid plans are activated by ModaFlow, not by the user. */
export async function requestPlanChangeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = requestSchema.safeParse({ note: "", ...Object.fromEntries(formData) });
  if (!parsed.success) return zodFailure(parsed.error, values);

  try {
    await api("/subscription/change-requests", { method: "POST", body: parsed.data });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    return apiFailure(error, values);
  }
  refresh();
  return { ok: true, message: "Solicitud enviada. Te contactaremos para coordinar el pago y activar tu plan." };
}

export async function cancelPlanChangeAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  try {
    await api(`/subscription/change-requests/${id}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    if (!(error instanceof ApiError && error.code === "REQUEST_NOT_FOUND")) throw error;
  }
  refresh();
}
