import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeader } from "@modaflow/ui/components/auth-card";
import { searchParam } from "@modaflow/ui/lib/search-params";
import { SetupPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Definir contraseña" };

async function Setup({ searchParams }: { searchParams: PageProps<"/acceso">["searchParams"] }) {
  const token = searchParam((await searchParams).token);
  if (!token) {
    return (
      <p className="text-sm text-muted-foreground">
        Este enlace no es válido. Pide uno nuevo al responsable del servidor o <Link href="/login" className="font-bold text-primary">vuelve al ingreso</Link>.
      </p>
    );
  }
  return <SetupPasswordForm token={token} />;
}

export default function SetupPage({ searchParams }: PageProps<"/acceso">) {
  return (
    <>
      <AuthHeader title="Define tu contraseña" description="El enlace es personal, sirve una sola vez y vence en 24 horas." />
      <Suspense fallback={null}>
        <Setup searchParams={searchParams} />
      </Suspense>
    </>
  );
}
