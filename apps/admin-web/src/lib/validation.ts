import { z } from "zod";
import { STAFF_PASSWORD_MIN } from "@/config/session";

const email = z.string().trim().toLowerCase().email({ error: "Ingresa un correo válido." }).max(254);

const newPassword = z
  .string()
  .min(STAFF_PASSWORD_MIN, { error: `Usa al menos ${STAFF_PASSWORD_MIN} caracteres.` })
  .max(128)
  .regex(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/, { error: "Incluye al menos una letra." })
  .regex(/\d/, { error: "Incluye al menos un número." });

export const loginSchema = z.object({ email, password: z.string().min(1, { error: "Ingresa tu contraseña." }).max(128) });

export const setupPasswordSchema = z
  .object({ token: z.string().min(20).max(200), password: newPassword, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { error: "Las contraseñas no coinciden.", path: ["confirmPassword"] });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, { error: "Ingresa tu contraseña actual." }).max(128), newPassword, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { error: "Las contraseñas no coinciden.", path: ["confirmPassword"] });

export function formValues(formData: FormData, omit: string[] = []): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !omit.includes(key) && !key.startsWith("$ACTION")) values[key] = value;
  }
  return values;
}
