import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeader } from "@modaflow/ui/components/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

async function ResetContent({ searchParams }: { searchParams: PageProps<"/restablecer-contrasena">["searchParams"] }) {
  const { token } = await searchParams;
  if (typeof token !== "string" || token.length < 20) {
    return (
      <div className="grid gap-4">
        <p role="alert" className="rounded-xl bg-destructive/5 px-3 py-2.5 text-sm font-semibold text-destructive">
          El enlace no es válido. Solicita uno nuevo.
        </p>
        <Link href="/recuperar-contrasena" className="text-sm font-bold text-primary hover:underline">
          Solicitar enlace de recuperación
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}

export default function ResetPasswordPage({ searchParams }: PageProps<"/restablecer-contrasena">) {
  return (
    <>
      <AuthHeader title="Crea una contraseña nueva" description="Al guardarla cerraremos tus sesiones abiertas." />
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <ResetContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
