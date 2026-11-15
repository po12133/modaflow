"use server";

import { redirect } from "next/navigation";
import { apiFailure, zodFailure } from "@modaflow/ui/lib/action-errors";
import { api, apiRequest, clearSessionCookie, persistSessionFromResponse } from "@/lib/api";
import type { FormState, Me } from "@/lib/types";
import {
  forgotPasswordSchema,
  formValues,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation";

const SECRET_FIELDS = ["password", "confirmPassword", "token"];

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
  const me = await api<Me>("/auth/me");
  redirect(me.needsOnboarding ? "/onboarding" : "/dashboard");
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, SECRET_FIELDS);
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodFailure(parsed.error, values);

  try {
    const { name, email, password } = parsed.data;
    const { response } = await apiRequest("/auth/register", {
      method: "POST",
      body: { name, email, password },
      auth: false,
    });
    await persistSessionFromResponse(response);
  } catch (error) {
    return apiFailure(error, values, { EMAIL_TAKEN: "email" });
  }
  // The free trial starts when the first store is created, not at sign-up.
  redirect("/onboarding");
}

export async function logoutAction(): Promise<void> {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // Even if the API is unreachable, the browser session is removed below.
  }
  await clearSessionCookie();
  redirect("/login");
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodFailure(parsed.error, values);

  try {
    const { message } = await api<{ message: string }>("/auth/password/forgot", {
      method: "POST",
      body: parsed.data,
      auth: false,
    });
    return { ok: true, message };
  } catch (error) {
    return apiFailure(error, values);
  }
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodFailure(parsed.error, {});

  try {
    await api("/auth/password/reset", {
      method: "POST",
      body: { token: parsed.data.token, password: parsed.data.password },
      auth: false,
    });
  } catch (error) {
    return apiFailure(error, {});
  }
  await clearSessionCookie();
  redirect("/login?restablecida=1");
}
