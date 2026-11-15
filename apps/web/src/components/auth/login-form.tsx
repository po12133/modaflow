"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/actions/auth";
import { FormMessage, SubmitButton, TextField } from "@modaflow/ui/components/form";
import type { FormState } from "@/lib/types";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <form action={action} className="grid gap-4" noValidate={false}>
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
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        maxLength={128}
        state={state}
      />
      <div className="-mt-1 text-right">
        <Link href="/recuperar-contrasena" className="text-sm font-semibold text-primary hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <SubmitButton pending={pending} pendingText="Ingresando…" className="w-full">
        Iniciar sesión
      </SubmitButton>
    </form>
  );
}
