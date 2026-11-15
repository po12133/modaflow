import { Camera, ChartColumn, ShoppingBag } from "lucide-react";
import { Brand } from "@modaflow/ui/components/brand";

const VALUE_PROPS = [
  { icon: Camera, text: "Registra prendas con fotos y deja el cuaderno." },
  { icon: ShoppingBag, text: "Vende y controla tu inventario automáticamente." },
  { icon: ChartColumn, text: "Consulta cómo va tu negocio desde el celular." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-gradient p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="inline-flex items-center gap-2.5 text-lg font-extrabold">
          <span className="grid size-9 place-items-center rounded-xl bg-white/20 text-xl font-black">M</span>
          ModaFlow
        </div>
        <div className="max-w-md">
          <h2 className="text-4xl leading-tight font-extrabold tracking-tight">
            El sistema inteligente para gestionar tu tienda de ropa desde tu celular.
          </h2>
          <ul className="mt-8 grid gap-4">
            {VALUE_PROPS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-base font-semibold text-white/95">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/20">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/80">Hecho para tiendas de ropa en Bolivia.</p>
        <div aria-hidden="true" className="absolute -right-24 -bottom-24 size-80 rounded-full bg-white/10" />
      </aside>

      <main className="flex flex-col px-4 py-6 sm:px-8 lg:justify-center lg:py-12">
        <div className="mx-auto w-full max-w-md">
          <Brand className="mb-8 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
