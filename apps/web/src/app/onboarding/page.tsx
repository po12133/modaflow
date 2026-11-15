import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Gift } from "lucide-react";
import { onboardingAction } from "@/actions/store";
import { Brand } from "@/components/brand";
import { StoreForm } from "@/components/store/store-form";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Configura tu tienda" };

// Per-request page (reads the session through the API).
export const instant = false;

async function OnboardingContent() {
  const me = await requireUser();
  if (!me.needsOnboarding) redirect("/dashboard");
  const firstName = me.user.name.split(" ")[0];

  return (
    <>
      <header className="mb-6">
        <p className="text-sm font-bold tracking-widest text-primary uppercase">Paso final</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
          {firstName}, configura tu tienda
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Con estos datos creamos tu tienda. Podrás cambiarlos cuando quieras.
        </p>
      </header>
      <div className="mb-6 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-[#efeaff] to-[#ffe9f1] p-4 text-sm text-violet-strong">
        <Gift className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>
          Al terminar se activa tu <strong>prueba gratuita de 14 días</strong> con el plan Gratis: hasta 30
          productos y 10 análisis con IA. Sin tarjeta.
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
        <StoreForm action={onboardingAction} submitLabel="Crear mi tienda" pendingText="Creando tu tienda…" />
      </div>
    </>
  );
}

export default function OnboardingPage() {
  return (
    <main className="min-h-dvh px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Brand className="mb-8" />
        <Suspense fallback={<div className="h-[36rem] animate-pulse rounded-2xl bg-muted" />}>
          <OnboardingContent />
        </Suspense>
      </div>
    </main>
  );
}
