import "server-only";
import type { z } from "zod";
import { ApiError } from "./api";
import type { FormState } from "./types";

/** Converts a failed zod parse into the form state shape. */
export function zodFailure(error: z.ZodError, values: Record<string, string>): FormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, message: "Revisa los campos marcados.", fieldErrors, values };
}

/**
 * Converts an API error into form state: field errors from VALIDATION_ERROR,
 * otherwise the API's user-facing message. Unknown errors are re-thrown.
 */
export function apiFailure(
  error: unknown,
  values: Record<string, string>,
  fieldForCode: Record<string, string> = {},
): FormState {
  if (!(error instanceof ApiError)) throw error;
  const message = error.message || "Ocurrió un error inesperado.";
  if (error.body.errors) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: error.body.errors, values };
  }
  const field = error.code ? fieldForCode[error.code] : undefined;
  if (field) return { ok: false, message, fieldErrors: { [field]: [message] }, values };
  return { ok: false, message, values };
}
