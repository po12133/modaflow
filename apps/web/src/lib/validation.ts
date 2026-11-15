import { z } from "zod";

/**
 * Frontend validation (mirrors the API rules in apps/api). Used by Server
 * Actions before calling the API; the API validates again on its side.
 */

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: "Ingresa un correo válido." }));

export const PASSWORD_HINT = "Mínimo 8 caracteres, con al menos una letra y un número.";

const password = z
  .string()
  .min(8, { error: "La contraseña debe tener al menos 8 caracteres." })
  .max(128, { error: "La contraseña no puede superar 128 caracteres." })
  .regex(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/, { error: "La contraseña debe incluir al menos una letra." })
  .regex(/\d/, { error: "La contraseña debe incluir al menos un número." });

const personName = z
  .string()
  .trim()
  .min(2, { error: "Ingresa tu nombre (mínimo 2 caracteres)." })
  .max(120, { error: "El nombre no puede superar 120 caracteres." });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Ingresa tu contraseña." }).max(128),
});

export const registerSchema = z
  .object({ name: personName, email, password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ token: z.string().min(20, { error: "El enlace no es válido." }), password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({ name: personName });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Ingresa tu contraseña actual." }),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

/** Same normalization as the API: Bolivian 8-digit mobiles get +591. */
export function normalizeWhatsapp(input: string): string | null {
  const trimmed = input.trim();
  if (!/^\+?[\d\s\-().]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+")) {
    if (/^[67]\d{7}$/.test(digits)) return `+591${digits}`;
    if (/^591[67]\d{7}$/.test(digits)) return `+${digits}`;
    return null;
  }
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} no puede superar ${max} caracteres.` })
    .transform((v) => (v === "" ? null : v));

export const storeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "El nombre comercial debe tener entre 2 y 80 caracteres." })
    .max(80, { error: "El nombre comercial debe tener entre 2 y 80 caracteres." }),
  description: optionalText(280, "La descripción"),
  whatsapp: z
    .string()
    .transform((v, ctx) => {
      const normalized = normalizeWhatsapp(v);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "Ingresa un WhatsApp válido, por ejemplo 71234567 o +59171234567." });
        return z.NEVER;
      }
      return normalized;
    }),
  city: z
    .string()
    .trim()
    .min(2, { error: "Ingresa la ciudad (mínimo 2 caracteres)." })
    .max(80, { error: "La ciudad no puede superar 80 caracteres." }),
  address: optionalText(200, "La dirección"),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, { error: "Elige un color válido." })
    .transform((v) => v.toUpperCase()),
});

export type StoreInput = z.infer<typeof storeSchema>;

/** Plain object of the string fields of a form (to re-populate inputs after an error). */
export function formValues(formData: FormData, omit: string[] = []): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !omit.includes(key) && !key.startsWith("$ACTION")) values[key] = value;
  }
  return values;
}

/** Time zones accepted by the API for business days in reports. */
export const STORE_TIMEZONES = [
  ["America/La_Paz", "Bolivia (La Paz)"],
  ["America/Lima", "Perú (Lima)"],
  ["America/Bogota", "Colombia (Bogotá)"],
  ["America/Guayaquil", "Ecuador (Guayaquil)"],
  ["America/Caracas", "Venezuela (Caracas)"],
  ["America/Santiago", "Chile (Santiago)"],
  ["America/Asuncion", "Paraguay (Asunción)"],
  ["America/Argentina/Buenos_Aires", "Argentina (Buenos Aires)"],
  ["America/Montevideo", "Uruguay (Montevideo)"],
  ["America/Sao_Paulo", "Brasil (São Paulo)"],
  ["America/Mexico_City", "México (Ciudad de México)"],
] as const;
