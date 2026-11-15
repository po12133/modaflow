"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "@/actions/auth";
import { FormMessage, SubmitButton, TextField } from "@/components/form";
import type { FormState } from "@/lib/types";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, {});

  if (state.ok) {
    return (
      <div className="grid gap-3">
        <FormMessage state={state} />
        <p className="text-sm text-muted-foreground">
          El enlace vence en 60 minutos. Si no llega, revisa tu carpeta de spam o vuelve a intentarlo.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <TextField
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoFocus
        maxLength={254}
        state={state}
      />
      <SubmitButton pending={pending} pendingText="Enviando…" className="w-full">
        Enviar enlace de recuperación
      </SubmitButton>
    </form>
  );
}
