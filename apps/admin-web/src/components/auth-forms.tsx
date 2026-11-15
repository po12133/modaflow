"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField } from "@modaflow/ui/components/form";
import type { FormState } from "@modaflow/ui/types/forms";
import { changePasswordAction, loginAction, setupPasswordAction } from "@/actions/auth";
import { STAFF_PASSWORD_MIN } from "@/config/session";

const hint = `Mínimo ${STAFF_PASSWORD_MIN} caracteres, con letras y números.`;

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <TextField label="Correo del equipo" name="email" type="email" autoComplete="username" inputMode="email" autoFocus maxLength={254} state={state} />
      <TextField label="Contraseña" name="password" type="password" autoComplete="current-password" maxLength={128} state={state} />
      <SubmitButton pending={pending} pendingText="Ingresando…" className="w-full">Ingresar</SubmitButton>
    </form>
  );
}

export function SetupPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setupPasswordAction, {});
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <TextField label="Nueva contraseña" name="password" type="password" autoComplete="new-password" maxLength={128} hint={hint} state={state} />
      <TextField label="Repite la contraseña" name="confirmPassword" type="password" autoComplete="new-password" maxLength={128} state={state} />
      <SubmitButton pending={pending} pendingText="Guardando…" className="w-full">Guardar contraseña</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <TextField label="Contraseña actual" name="currentPassword" type="password" autoComplete="current-password" maxLength={128} state={state} />
      <TextField label="Nueva contraseña" name="newPassword" type="password" autoComplete="new-password" maxLength={128} hint={hint} state={state} />
      <TextField label="Repite la nueva contraseña" name="confirmPassword" type="password" autoComplete="new-password" maxLength={128} state={state} />
      <SubmitButton pending={pending} pendingText="Guardando…" className="justify-self-start">Cambiar contraseña</SubmitButton>
    </form>
  );
}
