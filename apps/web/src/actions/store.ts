"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { apiFailure, zodFailure } from "@/lib/action-errors";
import { api, ApiError } from "@/lib/api";
import type { FormState } from "@/lib/types";
import { formValues, storeSchema, STORE_TIMEZONES } from "@/lib/validation";

/** Initial setup: creates the business, the first store and starts the 14-day trial. */
export async function onboardingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = storeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodFailure(parsed.error, values);

  try {
    await api("/onboarding", { method: "POST", body: parsed.data });
  } catch (error) {
    if (error instanceof ApiError && error.code === "ALREADY_ONBOARDED") redirect("/dashboard");
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    return apiFailure(error, values);
  }
  redirect("/dashboard?bienvenida=1");
}

export async function updateStoreAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = storeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodFailure(parsed.error, values);

  try {
    const timezone = formData.get("timezone");
    const body = typeof timezone === "string" && STORE_TIMEZONES.some(([tz]) => tz === timezone) ? { ...parsed.data, timezone } : parsed.data;
    await api("/stores/current", { method: "PUT", body });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    return apiFailure(error, values);
  }
  refresh();
  return { ok: true, message: "Cambios guardados." };
}
