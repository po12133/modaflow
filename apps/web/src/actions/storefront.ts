"use server";

import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import type { ActionResult } from "@/types/actions";
import type { OrderIssue, OrderRequestResult } from "@/types/catalog";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const orderSchema = z.object({
  slug: z.string().regex(SLUG).max(60),
  items: z
    .array(z.object({ productSlug: z.string().regex(SLUG).max(160), sku: z.string().min(1).max(48), quantity: z.number().int().min(1).max(10) }))
    .min(1)
    .max(20),
});

export async function createOrderRequestAction(input: z.input<typeof orderSchema>): Promise<ActionResult<OrderRequestResult>> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisa tu carrito." };
  const { slug, items } = parsed.data;
  try {
    return { ok: true, data: await api<OrderRequestResult>(`/public/stores/${slug}/order-requests`, { method: "POST", body: { items }, auth: false }) };
  } catch (error) {
    if (error instanceof ApiError) {
      const issues = (error.body as { issues?: OrderIssue[] }).issues;
      return { ok: false, code: error.code, message: error.message || "No se pudo preparar tu consulta.", details: issues };
    }
    return { ok: false, message: "No pudimos conectar. Intenta de nuevo." };
  }
}

export async function markWhatsappOpenedAction(slug: string, code: string, token: string): Promise<void> {
  if (!SLUG.test(slug) || !/^[A-Z0-9]{6,12}$/.test(code) || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return;
  try {
    await api(`/public/stores/${slug}/order-requests/${code}/whatsapp`, { method: "POST", body: { token }, auth: false });
  } catch {
    return;
  }
}
