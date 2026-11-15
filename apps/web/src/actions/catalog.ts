"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { apiFailure } from "@modaflow/ui/lib/action-errors";
import { api, ApiError } from "@/lib/api";
import type { FormState } from "@/lib/types";
import { formValues } from "@/lib/validation";
import type { ActionResult } from "@modaflow/ui/types/actions";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const nullable = (max: number) => z.string().trim().max(max).transform((v) => v || null);

const settingsSchema = z.object({
  name: z.string().trim().min(2, { error: "Escribe el nombre de la tienda." }).max(80),
  slug: z.string().trim().toLowerCase().min(3, { error: "Mínimo 3 caracteres." }).max(60),
  description: nullable(280),
  whatsapp: z.string().trim().min(7, { error: "Escribe el WhatsApp de la tienda." }).max(20),
  primaryColor: z.string().regex(HEX),
  secondaryColor: z.string().regex(HEX),
  welcomeMessage: nullable(300),
  outOfStock: z.enum(["SHOW", "HIDE"]),
  status: z.enum(["PUBLISHED", "HIDDEN"]),
});

function fail(error: unknown): ActionResult<never> {
  if (error instanceof ApiError) {
    if (error.status === 401) redirect("/login");
    return { ok: false, code: error.code, message: error.message || "Ocurrió un error inesperado." };
  }
  return { ok: false, message: "No pudimos conectar con el servidor. Intenta de nuevo." };
}

export async function updateCatalogSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[String(issue.path[0])] ??= []).push(issue.message);
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors, values };
  }
  try {
    await api("/catalog/settings", { method: "PATCH", body: parsed.data });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    return apiFailure(error, values, { SLUG_TAKEN: "slug", SLUG_INVALID: "slug" });
  }
  refresh();
  return { ok: true, message: "Catálogo actualizado." };
}

export async function checkSlugAction(slug: string): Promise<{ available: boolean; message: string | null }> {
  const clean = slug.trim().toLowerCase().slice(0, 80);
  try {
    return await api(`/catalog/slug-availability?slug=${encodeURIComponent(clean)}`);
  } catch {
    return { available: false, message: "No se pudo comprobar la dirección." };
  }
}

export async function setProductPublishedAction(id: string, catalogPublished: boolean): Promise<ActionResult<null>> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Producto no válido." };
  try {
    await api(`/catalog/products/${id}`, { method: "PATCH", body: { catalogPublished } });
  } catch (error) {
    return fail(error);
  }
  refresh();
  return { ok: true, data: null };
}

export async function bulkPublishAction(ids: string[], catalogPublished: boolean): Promise<ActionResult<{ updated: number }>> {
  const parsed = z.array(z.string().uuid()).min(1).max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, message: "Selecciona al menos un producto." };
  try {
    const data = await api<{ updated: number }>("/catalog/products/bulk-update", { method: "POST", body: { ids: parsed.data, catalogPublished } });
    refresh();
    return { ok: true, data };
  } catch (error) {
    return fail(error);
  }
}

export async function updateRequestStatusAction(id: string, status: "ATTENDED" | "CANCELED"): Promise<ActionResult<null>> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Solicitud no válida." };
  try {
    await api(`/catalog/order-requests/${id}`, { method: "PATCH", body: { status } });
  } catch (error) {
    return fail(error);
  }
  refresh();
  return { ok: true, data: null };
}

export async function removeCatalogMediaAction(kind: "logo" | "cover"): Promise<ActionResult<null>> {
  try {
    await api(`/catalog/media/${kind === "logo" ? "logo" : "cover"}`, { method: "DELETE" });
  } catch (error) {
    return fail(error);
  }
  refresh();
  return { ok: true, data: null };
}
