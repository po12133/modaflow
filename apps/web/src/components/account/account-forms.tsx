"use client";

import { useActionState } from "react";
import { changePasswordAction, updateProfileAction } from "@/actions/account";
import { FormMessage, SubmitButton, TextField } from "@/components/form";
import type { FormState } from "@/lib/types";
import { PASSWORD_HINT } from "@/lib/validation";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, {});
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <TextField label="Nombre" name="name" defaultValue={name} autoComplete="name" minLength={2} maxLength={120} state={state} />
      <TextField
        label="Correo electrónico"
        name="email-readonly"
        defaultValue={email}
        readOnly
        disabled
        hint="Por ahora el correo no se puede cambiar."
      />
      <SubmitButton pending={pending} className="w-full sm:w-auto sm:justify-self-start">
        Guardar perfil
      </SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <TextField
        label="Contraseña actual"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        maxLength={128}
        state={state}
      />
      <TextField
        label="Contraseña nueva"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        hint={PASSWORD_HINT}
        state={state}
      />
      <TextField
        label="Repite la contraseña nueva"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        state={state}
      />
      <SubmitButton pending={pending} className="w-full sm:w-auto sm:justify-self-start">
        Cambiar contraseña
      </SubmitButton>
    </form>
  );
}
