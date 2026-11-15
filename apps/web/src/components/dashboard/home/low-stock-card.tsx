import Link from "next/link";
import { plural } from "@modaflow/ui/lib/format";
import type { SalesSummary } from "@/lib/types";

export function LowStockCard({ lowStock }: { lowStock: SalesSummary["lowStock"] }) {
  return (
    <section aria-labelledby="low-title" className="grid gap-2 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="low-title" className="font-extrabold">
              Stock bajo <span className="ml-1 rounded-full bg-amber/15 px-2 py-0.5 text-xs font-bold text-[#7a4f00]">{lowStock.total}</span>
            </h2>
            <Link href="/dashboard/reportes/inventario" className="text-sm font-bold text-primary">
              Ver todos
            </Link>
          </div>
          <ul className="divide-y text-sm">
            {lowStock.items.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/productos/${p.id}`} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                  <span className="text-xs font-bold whitespace-nowrap text-[#7a4f00]">{plural(p.stock, "unidad", "unidades")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
  );
}
