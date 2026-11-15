"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import type { Paginated, PosProduct, SaleDetail, SalePreview } from "@/lib/types";

export type SaleActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string; fieldErrors?: Record<string, string[]>; available?: number; variantId?: string };

function fail(error: unknown): SaleActionResult<never> {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect("/login");
    const body = error.body as typeof error.body & { available?: number; variantId?: string };
    return {
      ok: false,
      code: error.code,
      message: error.message || "Ocurrió un error inesperado.",
      fieldErrors: error.body.errors,
      available: body.available,
      variantId: body.variantId,
    };
  }
  // Network/unknown: keep the cart, let the seller retry.
  return { ok: false, code: "UNKNOWN", message: "No pudimos conectar con el servidor. Tu venta no se registró; intenta de nuevo." };
}

const discount = z
  .object({ type: z.enum(["PERCENT", "AMOUNT"]), value: z.string().trim().max(12) })
  .nullable()
  .optional();

const cartSchema = z.object({
  items: z
    .array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(10_000), discount }))
    .min(1, { error: "Agrega al menos una prenda." })
    .max(100),
  discount,
  paymentMethod: z.enum(["CASH", "QR", "TRANSFER", "OTHER"]).optional(),
  amountReceived: z.string().trim().max(12).optional(),
});

export type CartInput = z.input<typeof cartSchema>;

function cleanCart(input: z.output<typeof cartSchema>) {
  return {
    items: input.items.map((i) => ({ ...i, discount: i.discount && i.discount.value ? i.discount : null })),
    discount: input.discount && input.discount.value ? input.discount : null,
    ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
    ...(input.amountReceived ? { amountReceived: input.amountReceived } : {}),
  };
}

export async function searchPosProductsAction(params: {
  search?: string;
  categoryId?: string;
  includeOutOfStock?: boolean;
  page?: number;
}): Promise<SaleActionResult<Paginated<PosProduct>>> {
  const qs = new URLSearchParams({ pageSize: "24" });
  if (params.search?.trim()) qs.set("search", params.search.trim().slice(0, 80));
  if (params.categoryId && /^[0-9a-f-]{36}$/i.test(params.categoryId)) qs.set("categoryId", params.categoryId);
  if (params.includeOutOfStock) qs.set("includeOutOfStock", "true");
  if (params.page && params.page > 1) qs.set("page", String(Math.trunc(params.page)));
  try {
    return { ok: true, data: await api<Paginated<PosProduct>>(`/pos/products?${qs}`) };
  } catch (error) {
    return fail(error);
  }
}

export async function previewSaleAction(input: CartInput): Promise<SaleActionResult<SalePreview>> {
  const parsed = cartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisa la venta." };
  try {
    return { ok: true, data: await api<SalePreview>("/pos/preview", { method: "POST", body: cleanCart(parsed.data) }) };
  } catch (error) {
    return fail(error);
  }
}

const createSchema = cartSchema.extend({
  paymentMethod: z.enum(["CASH", "QR", "TRANSFER", "OTHER"], { error: "Elige el método de pago." }),
  paymentConfirmed: z.literal(true, { error: "Confirma que recibiste el pago." }),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
});

export async function createSaleAction(input: z.input<typeof createSchema>): Promise<SaleActionResult<{ id: string; number: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa la venta." };
  try {
    const sale = await api<SaleDetail>("/sales", {
      method: "POST",
      body: { ...cleanCart(parsed.data), paymentConfirmed: true, idempotencyKey: parsed.data.idempotencyKey },
    });
    return { ok: true, data: { id: sale.id, number: sale.number } };
  } catch (error) {
    return fail(error);
  }
}

const cancelSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(3, { error: "Indica el motivo (mínimo 3 caracteres)." }).max(200),
  notes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
});

export async function cancelSaleAction(input: z.input<typeof cancelSchema>): Promise<SaleActionResult<null>> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { id, ...body } = parsed.data;
  try {
    await api(`/sales/${id}/cancel`, { method: "POST", body: { ...body, notes: body.notes || null } });
  } catch (error) {
    return fail(error);
  }
  refresh();
  return { ok: true, data: null };
}

export async function createReceiptLinkAction(id: string): Promise<SaleActionResult<{ token: string; path: string }>> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Venta no válida." };
  try {
    return { ok: true, data: await api<{ token: string; path: string }>(`/sales/${id}/receipt-link`, { method: "POST" }) };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeReceiptLinkAction(id: string): Promise<SaleActionResult<null>> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Venta no válida." };
  try {
    await api(`/sales/${id}/receipt-link`, { method: "DELETE" });
  } catch (error) {
    return fail(error);
  }
  refresh();
  return { ok: true, data: null };
}
