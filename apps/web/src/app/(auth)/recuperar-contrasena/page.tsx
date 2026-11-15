import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeader } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeader
        title="Recupera tu contraseña"
        description="Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva."
      />
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-bold text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </>
  );
}
