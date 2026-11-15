import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeader } from "@modaflow/ui/components/auth-card";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Ingresar" };

async function ReadyNotice({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  if ((await searchParams).listo !== "1") return null;
  return <p role="status" className="mb-4 rounded-xl bg-mint/10 px-3 py-2.5 text-sm font-semibold text-[#0b7a66]">Contraseña guardada. Ya puedes ingresar.</p>;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <AuthHeader title="Administración" description="Acceso exclusivo para el equipo de ModaFlow. Las cuentas de tiendas no sirven aquí." />
      <Suspense fallback={null}>
        <ReadyNotice searchParams={searchParams} />
      </Suspense>
      <LoginForm />
      <p className="mt-6 text-center text-xs text-muted-foreground">¿Olvidaste tu contraseña? Pide un enlace nuevo al responsable del servidor.</p>
    </>
  );
}
