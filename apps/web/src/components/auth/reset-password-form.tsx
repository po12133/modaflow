"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/actions/auth";
import { FormMessage, SubmitButton, TextField } from "@/components/form";
import type { FormState } from "@/lib/types";
import { PASSWORD_HINT } from "@/lib/validation";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, {});

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <TextField
        label="Contraseña nueva"
        name="password"
        type="password"
        autoComplete="new-password"
        autoFocus
        minLength={8}
        maxLength={128}
        hint={PASSWORD_HINT}
        state={state}
      />
      <TextField
        label="Repite la contraseña"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        state={state}
      />
      <SubmitButton pending={pending} className="w-full">
        Guardar contraseña
      </SubmitButton>
    </form>
  );
}
