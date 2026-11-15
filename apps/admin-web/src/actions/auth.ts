"use server";

import { redirect } from "next/navigation";
import { apiFailure, zodFailure } from "@modaflow/ui/lib/action-errors";
import type { FormState } from "@modaflow/ui/types/forms";
import { api, apiRequest, clearSessionCookie, persistSessionFromResponse } from "@/lib/api";
import { changePasswordSchema, formValues, loginSchema, setupPasswordSchema } from "@/lib/validation";

const SECRET_FIELDS = ["password", "confirmPassword", "currentPassword", "newPassword", "token"];

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, SECRET_FIELDS);
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodFailure(parsed.error, values);
  try {
    const { response } = await apiRequest("/auth/login", { method: "POST", body: parsed.data, auth: false });
    await persistSessionFromResponse(response);
  } catch (error) {
    return apiFailure(error, values);
  }
  redirect("/");
}

export async function setupPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = setupPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodFailure(parsed.error, {});
  try {
    await api("/auth/setup-password", { method: "POST", body: { token: parsed.data.token, password: parsed.data.password }, auth: false });
  } catch (error) {
    return apiFailure(error, {});
  }
  redirect("/login?listo=1");
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodFailure(parsed.error, {});
  try {
    await api("/auth/password", { method: "POST", body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword } });
  } catch (error) {
    return apiFailure(error, {}, { INVALID_PASSWORD: "currentPassword" });
  }
  return { ok: true, message: "Contraseña actualizada. Se cerraron tus otras sesiones." };
}

export async function logoutAction(): Promise<void> {
  await api("/auth/logout", { method: "POST" }).catch(() => undefined);
  await clearSessionCookie();
  redirect("/login");
}
