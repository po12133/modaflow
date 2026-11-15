"use client";

import { useActionState } from "react";
import { registerAction } from "@/actions/auth";
import { FormMessage, SubmitButton, TextField } from "@modaflow/ui/components/form";
import type { FormState } from "@/lib/types";
import { PASSWORD_HINT } from "@/lib/validation";

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, {});

  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <TextField label="Tu nombre" name="name" autoComplete="name" autoFocus minLength={2} maxLength={120} state={state} />
      <TextField
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        maxLength={254}
        state={state}
      />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
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
      <SubmitButton pending={pending} pendingText="Creando cuenta…" className="w-full">
        Crear cuenta
      </SubmitButton>
    </form>
  );
}
