"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import type { ActionResult } from "@modaflow/ui/types/actions";
import type { PaymentRequest } from "@modaflow/ui/types/billing";

const uuid = z.string().uuid();

function fail(error: unknown): ActionResult<never> {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect("/login");
    return { ok: false, code: error.code, message: error.message || "Ocurrió un error inesperado." };
  }
  return { ok: false, message: "No pudimos conectar con el servidor. Intenta de nuevo." };
}

export async function createPaymentRequestAction(planCode: string, method: "QR" | "TRANSFER"): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ planCode: z.string().regex(/^[a-z0-9_-]{2,32}$/), method: z.enum(["QR", "TRANSFER"]) }).safeParse({ planCode, method });
  if (!parsed.success) return { ok: false, message: "Elige un plan y un método de pago." };
  try {
    const req = await api<PaymentRequest>("/subscription/payment-requests", { method: "POST", body: parsed.data });
    return { ok: true, data: { id: req.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function submitPaymentAction(id: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return { ok: false, message: "Solicitud no válida." };
  try {
    await api(`/subscription/payment-requests/${id}/submit`, { method: "POST" });
  } catch (error) {
    return fail(error);
  }
  refresh();
  return { ok: true, data: null };
}

export async function cancelPaymentAction(id: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return { ok: false, message: "Solicitud no válida." };
  try {
    await api(`/subscription/payment-requests/${id}/cancel`, { method: "POST" });
  } catch (error) {
    return fail(error);
  }
  refresh();
  return { ok: true, data: null };
}

export async function markNotificationReadAction(id: string): Promise<void> {
  if (id !== "all" && !uuid.safeParse(id).success) return;
  try {
    await api(id === "all" ? "/notifications/read-all" : `/notifications/${id}/read`, { method: "POST" });
  } catch {
    return;
  }
  refresh();
}
