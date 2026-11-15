import Link from "next/link";
import { ChevronRight, ClipboardList, Eye, EyeOff, PackageX, Settings } from "lucide-react";
import type { CatalogSummary } from "@/types/catalog";

export function CatalogStats({ summary }: { summary: CatalogSummary }) {
  const stats: [string, number, typeof Eye][] = [
    ["Publicados", summary.published, Eye],
    ["Ocultos", summary.hidden, EyeOff],
    ["Publicados agotados", summary.publishedOutOfStock, PackageX],
    ["Solicitudes", summary.requests, ClipboardList],
  ];
  return (
    <section aria-label="Indicadores del catálogo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(([label, value, Icon]) => (
        <div key={label} className="grid gap-1 rounded-2xl border bg-card p-3.5 shadow-sm">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="text-2xl font-extrabold">{value}</p>
        </div>
      ))}
    </section>
  );
}

export function CatalogLinks({ pending }: { pending: number }) {
  const links: [string, string, string, typeof Eye][] = [
    ["/dashboard/catalogo/productos", "Productos del catálogo", "Elige qué prendas mostrar", Eye],
    ["/dashboard/catalogo/solicitudes", "Solicitudes de pedido", pending ? `${pending} por atender` : "Consultas enviadas desde el catálogo", ClipboardList],
    ["/dashboard/catalogo/configuracion", "Configuración", "Dirección, logo, portada, colores y WhatsApp", Settings],
  ];
  return (
    <nav aria-label="Gestión del catálogo" className="grid gap-2 sm:grid-cols-3">
      {links.map(([href, title, sub, Icon]) => (
        <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm hover:border-ring">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block font-bold">{title}</span>
            <span className="block truncate text-xs text-muted-foreground">{sub}</span>
          </span>
          <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}
