import Link from "next/link";
import { Suspense } from "react";
import { Camera, ChartColumn, ShoppingBag } from "lucide-react";
import { Brand } from "@/components/brand";
import { PlanCards } from "@/components/plans/plan-cards";
import { Button } from "@/components/ui/button";
import { getPlans } from "@/lib/dal";

const STEPS = [
  { icon: Camera, title: "Registra tus prendas", text: "Con fotos y ayuda de la IA, sin cuaderno." },
  { icon: ShoppingBag, title: "Vende y controla tu stock", text: "El inventario se actualiza solo con cada venta." },
  { icon: ChartColumn, title: "Mira cómo va tu negocio", text: "Reportes claros desde tu celular." },
];

async function Plans() {
  const plans = await getPlans().catch(() => null);
  if (!plans) {
    return (
      <p role="alert" className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
        No pudimos cargar los planes en este momento. Intenta de nuevo en unos minutos.
      </p>
    );
  }
  return (
    <PlanCards
      plans={plans}
      renderAction={(plan) => (
        <Button asChild size="lg" variant={plan.isRecommended ? "default" : "outline"} className="h-11 w-full">
          <Link href="/registro">{plan.isTrial ? "Empezar gratis" : "Probar gratis 14 días"}</Link>
        </Button>
      )}
    />
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Brand />
          <nav aria-label="Cuenta" className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="lg" className="h-10">
              <Link href="/login">Ingresar</Link>
            </Button>
            <Button asChild size="lg" className="hidden h-10 sm:inline-flex">
              <Link href="/registro">Crear cuenta</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-12 pb-10 text-center sm:pt-20">
          <p className="text-xs font-extrabold tracking-[0.14em] text-primary uppercase">Para tiendas de ropa en Bolivia</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-6xl">
            Gestiona tu tienda de ropa <span className="text-brand-gradient">desde tu celular</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Inventario, ventas y reportes en un solo lugar. Empieza con 14 días gratis, sin tarjeta.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 bg-brand-gradient px-6 text-base">
              <Link href="/registro">Crear mi tienda gratis</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
              <Link href="#planes">Ver planes</Link>
            </Button>
          </div>
        </section>

        <section aria-label="Cómo funciona" className="mx-auto grid max-w-6xl gap-3 px-4 pb-14 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-bold">{title}</h2>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </section>

        <section id="planes" aria-labelledby="planes-title" className="scroll-mt-20 bg-white py-14">
          <div className="mx-auto max-w-6xl px-4">
            <p className="text-center text-xs font-extrabold tracking-[0.14em] text-primary uppercase">Planes</p>
            <h2 id="planes-title" className="mt-2 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
              Elige el plan que acompaña a tu tienda
            </h2>
            <div className="mt-10">
              <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" aria-label="Cargando planes" />}>
                <Plans />
              </Suspense>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-sm text-muted-foreground">
          <Brand className="text-base" />
          <p>Precios en bolivianos. Sujetos a las condiciones del servicio.</p>
        </div>
      </footer>
    </div>
  );
}
