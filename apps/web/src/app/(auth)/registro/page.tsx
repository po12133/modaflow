import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeader } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <>
      <AuthHeader
        title="Crea tu cuenta"
        description="Después configuras tu tienda y empiezas tu prueba gratuita de 14 días, sin tarjeta."
      />
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-bold text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}
