import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CircleCheck } from "lucide-react";
import { AuthHeader } from "@modaflow/ui/components/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

async function ResetNotice({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  if (params.restablecida !== "1") return null;
  return (
    <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-mint/10 px-3 py-2.5 text-sm font-semibold text-[#0b7a66]">
      <CircleCheck className="size-4" aria-hidden="true" />
      Contraseña actualizada. Ya puedes iniciar sesión.
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <AuthHeader title="Hola de nuevo" description="Ingresa para administrar tu tienda." />
      <Suspense fallback={null}>
        <ResetNotice searchParams={searchParams} />
      </Suspense>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="font-bold text-primary hover:underline">
          Crea tu cuenta gratis
        </Link>
      </p>
    </>
  );
}
