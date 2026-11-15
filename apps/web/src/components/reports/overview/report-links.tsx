import Link from "next/link";
import { ChevronRight, Package, ReceiptText, Shirt, type LucideIcon } from "lucide-react";

const LINKS: [string, string, string, LucideIcon][] = [
  ["/ventas", "Reporte de ventas", "Detalle por venta, vendedor y método", ReceiptText],
  ["/productos", "Productos vendidos", "Ranking, variantes y categorías", Shirt],
  ["/inventario", "Inventario", "Stock bajo, valor y movimientos", Package],
];

export function ReportLinks({ query }: { query: string }) {
  return (
    <nav aria-label="Reportes detallados" className="grid gap-2 sm:grid-cols-3">
      {LINKS.map(([path, title, sub, Icon]) => (
        <Link key={path} href={`/dashboard/reportes${path}${query}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm hover:border-ring">
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
