import Link from "next/link";
import { Camera, ChartLine, Package, ShoppingCart } from "lucide-react";

export function QuickActions({ productCount }: { productCount: number }) {
  return (
      <section aria-labelledby="quick-actions" className="grid gap-3">
        <h2 id="quick-actions" className="sr-only">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/productos/nuevo"
            className="grid min-h-32 content-start gap-1 rounded-[20px] bg-brand-gradient p-4 text-white shadow-[0_16px_30px_-18px_rgba(22,19,43,0.6)] transition-transform active:scale-[0.98]"
          >
            <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-white/20">
              <Camera className="size-6" aria-hidden="true" />
            </span>
            <b className="text-base leading-tight">Registrar prenda</b>
            <span className="text-xs opacity-90">Con foto e IA</span>
          </Link>
          <Link
            href="/dashboard/ventas/nueva"
            className="grid min-h-32 content-start gap-1 rounded-[20px] bg-gradient-to-br from-[#16132b] to-[#3b2f7a] p-4 text-white shadow-[0_16px_30px_-18px_rgba(22,19,43,0.6)] transition-transform active:scale-[0.98]"
          >
            <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-white/20">
              <ShoppingCart className="size-6" aria-hidden="true" />
            </span>
            <b className="text-base leading-tight">Nueva venta</b>
            <span className="text-xs opacity-90">Cobra y entrega la boleta</span>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/dashboard/productos", label: "Inventario", icon: Package, note: `${productCount} productos` },
            { href: "/dashboard/reportes", label: "Reportes", icon: ChartLine, note: "Ventas, ganancias y stock" },
          ].map(({ href, label, icon: Icon, note }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm hover:border-ring"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold">{label}</span>
                <span className="block text-xs text-muted-foreground">{note}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
  );
}
