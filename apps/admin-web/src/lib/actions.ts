import "server-only";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@modaflow/ui/types/actions";
import { api, ApiError } from "./api";

export const uuid = z.string().uuid();
export const reason = z.string().trim().min(5, { error: "Escribe un motivo (mínimo 5 caracteres)." }).max(500);
export const text = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function mutate<T = null>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<ActionResult<T>> {
  let data: T;
  try {
    data = await api<T>(path, { method, body });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) redirect("/login");
      const field = error.body.errors ? Object.values(error.body.errors)[0]?.[0] : undefined;
      return { ok: false, code: error.code, message: field ?? error.message ?? "No se pudo completar la acción." };
    }
    return { ok: false, message: "No pudimos conectar con el servidor. Intenta de nuevo." };
  }
  refresh();
  return { ok: true, data };
}

export function check<T>(schema: z.ZodType<T>, value: unknown): { ok: true; data: T } | { ok: false; message: string } {
  const parsed = schema.safeParse(value);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
}
