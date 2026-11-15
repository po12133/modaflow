"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { apiFailure, zodFailure } from "@modaflow/ui/lib/action-errors";
import { api, ApiError } from "@/lib/api";
import type { FormState } from "@/lib/types";
import { changePasswordSchema, formValues, profileSchema } from "@/lib/validation";

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodFailure(parsed.error, values);

  try {
    await api("/users/me", { method: "PATCH", body: parsed.data });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    return apiFailure(error, values);
  }
  refresh();
  return { ok: true, message: "Perfil actualizado." };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodFailure(parsed.error, {});

  try {
    await api("/users/me/password", {
      method: "POST",
      body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    return apiFailure(error, {}, { INVALID_CURRENT_PASSWORD: "currentPassword" });
  }
  return { ok: true, message: "Contraseña actualizada. Cerramos tus otras sesiones." };
}
