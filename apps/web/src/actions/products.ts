"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import type { AiAnalysis, Category, Movement, ProductDetail } from "@/lib/types";

/** Result of JSON-based actions (the product form is not a plain HTML form). */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string; fieldErrors?: Record<string, string[]> };

function fail(error: unknown): ActionResult<never> {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect("/login");
    return {
      ok: false,
      code: error.code,
      message: error.body.errors ? "Revisa los campos marcados." : error.message || "Ocurrió un error inesperado.",
      fieldErrors: error.body.errors,
    };
  }
  throw error;
}

function zodFail(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, message: "Revisa los campos marcados.", fieldErrors };
}

// ---------------------------------------------------------------------------
// Product form
// ---------------------------------------------------------------------------

const money = z
  .string()
  .trim()
  .transform((v) => v.replace(",", "."))
  .pipe(z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, { error: "Ingresa un precio válido, por ejemplo 69 o 69.50." }));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres.` })
    .transform((v) => (v === "" ? null : v));

const variantSchema = z.object({
  size: optionalText(20),
  color: optionalText(40),
  quantity: z
    .number({ error: "Ingresa la cantidad." })
    .int({ error: "La cantidad debe ser un número entero." })
    .min(0, { error: "La cantidad no puede ser negativa." })
    .max(100_000),
});

const productSchema = z.object({
  name: z.string().trim().min(2, { error: "Ingresa el nombre (mínimo 2 caracteres)." }).max(120),
  description: optionalText(500),
  garmentType: optionalText(60),
  color: optionalText(40),
  secondaryColors: z.array(z.string().trim().max(40)).max(5),
  style: optionalText(60),
  categoryId: z.string().uuid().nullable(),
  categoryName: optionalText(60),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  salePrice: money.refine((v) => Number(v) > 0, { error: "El precio de venta debe ser mayor a 0." }),
  purchasePrice: z.union([money, z.literal("").transform(() => null)]),
  sku: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.union([z.literal(""), z.string().regex(/^[A-Z0-9][A-Z0-9._-]{1,47}$/, { error: "Solo letras, números, puntos y guiones." })]))
    .transform((v) => v || undefined),
  lowStockThreshold: z.number().int().min(0).max(10_000),
  imageIds: z.array(z.string().uuid()).max(6, { error: "Hasta 6 fotos por prenda." }),
  primaryImageId: z.string().uuid().optional(),
  aiAnalysisId: z.string().uuid().optional(),
});

const createSchema = productSchema.extend({
  id: z.string().uuid(),
  variants: z.array(variantSchema).min(1, { error: "Agrega al menos una talla o la opción talla única." }).max(50),
});

const updateSchema = productSchema.extend({
  variantsAdd: z.array(variantSchema).max(50),
});

export type ProductFormInput = z.input<typeof createSchema>;
export type ProductUpdateInput = z.input<typeof updateSchema>;

export async function createProductAction(input: ProductFormInput): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const product = await api<ProductDetail>("/products", { method: "POST", body: parsed.data });
    return { ok: true, data: { id: product.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function updateProductAction(id: string, input: ProductUpdateInput): Promise<ActionResult<{ id: string }>> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { imageIds, primaryImageId, variantsAdd, ...rest } = parsed.data;
  // The AI analysis link is only set when creating a product.
  const fields = { ...rest, aiAnalysisId: undefined };
  try {
    await api<ProductDetail>(`/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: {
        ...fields,
        images: { imageIds, primaryImageId },
        ...(variantsAdd.length ? { variantsAdd } : {}),
      },
    });
    refresh();
    return { ok: true, data: { id } };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveProductAction(id: string): Promise<ActionResult> {
  try {
    await api(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    return fail(error);
  }
  refresh();
  return { ok: true, data: undefined };
}

export async function restoreProductAction(id: string): Promise<ActionResult> {
  try {
    await api(`/products/${encodeURIComponent(id)}/restore`, { method: "POST" });
  } catch (error) {
    return fail(error);
  }
  refresh();
  return { ok: true, data: undefined };
}

export async function deletePendingImageAction(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Foto no válida." };
  try {
    await api(`/product-images/${id}`, { method: "DELETE" });
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof ApiError && error.code === "IMAGE_NOT_FOUND") return { ok: true, data: undefined };
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

const analyzeSchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1, { error: "Sube al menos una foto." }).max(4, { error: "Analiza hasta 4 fotos." }),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
});

export async function analyzeGarmentAction(input: z.input<typeof analyzeSchema>): Promise<ActionResult<AiAnalysis>> {
  const parsed = analyzeSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const analysis = await api<AiAnalysis>("/ai/analyze-garment", { method: "POST", body: parsed.data });
    return { ok: true, data: analysis };
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Inventory movements
// ---------------------------------------------------------------------------

const movementSchema = z
  .object({
    kind: z.enum(["entry", "exit", "adjust_in", "adjust_out"]),
    variantId: z.string().uuid(),
    quantity: z
      .number({ error: "Ingresa la cantidad." })
      .int({ error: "La cantidad debe ser un número entero." })
      .min(1, { error: "La cantidad debe ser mayor a 0." })
      .max(100_000),
    reason: z.string().trim().max(200),
    reference: z.string().trim().max(80),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  })
  .refine((d) => d.kind === "entry" || d.reason.length >= 3, {
    error: "Indica el motivo (mínimo 3 caracteres).",
    path: ["reason"],
  });

export async function stockMovementAction(input: z.input<typeof movementSchema>): Promise<ActionResult<Movement>> {
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { kind, reason, reference, ...rest } = parsed.data;
  const base = { ...rest, reason: reason || null, reference: reference || null };
  const [path, body] =
    kind === "entry"
      ? ["/inventory/entries", base]
      : kind === "exit"
        ? ["/inventory/exits", base]
        : ["/inventory/adjustments", { ...base, direction: kind === "adjust_in" ? "IN" : "OUT" }];
  try {
    const movement = await api<Movement>(path, { method: "POST", body });
    refresh();
    return { ok: true, data: movement };
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const categoryName = z.string().trim().min(2, { error: "Mínimo 2 caracteres." }).max(60, { error: "Máximo 60 caracteres." });

export async function createCategoryAction(name: string): Promise<ActionResult<Category>> {
  const parsed = categoryName.safeParse(name);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const category = await api<Category>("/categories", { method: "POST", body: { name: parsed.data } });
    refresh();
    return { ok: true, data: category };
  } catch (error) {
    return fail(error);
  }
}

export async function renameCategoryAction(id: string, name: string): Promise<ActionResult<Category>> {
  const parsed = categoryName.safeParse(name);
  if (!parsed.success) return zodFail(parsed.error);
  try {
    const category = await api<Category>(`/categories/${encodeURIComponent(id)}`, { method: "PATCH", body: { name: parsed.data } });
    refresh();
    return { ok: true, data: category };
  } catch (error) {
    return fail(error);
  }
}
