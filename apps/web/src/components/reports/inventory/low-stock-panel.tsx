import Link from "next/link";
import { LOW_STOCK_OPTIONS } from "@/config/reports";
import { plural } from "@/lib/format";
import type { InventoryReport } from "@/types/reports";
import { UrlSelect, UrlToggle } from "../controls/url-fields";
import { Panel } from "@/components/common/panel";

interface LowStockPanelProps {
  lowStock: InventoryReport["lowStock"];
  threshold?: string;
  includeUnique: boolean;
}

export function LowStockPanel({ lowStock, threshold, includeUnique }: LowStockPanelProps) {
  return (
    <Panel title="Stock bajo">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[14rem_1fr] sm:items-end">
        <UrlSelect name="lowStock" label="Umbral" value={threshold ?? ""} options={LOW_STOCK_OPTIONS} />
        <UrlToggle name="includeUnique" label="Incluir prendas únicas (1 unidad, talla única)" checked={includeUnique} />
      </div>
      {!includeUnique && lowStock.uniqueExcluded > 0 && (
        <p className="text-xs text-muted-foreground">
          No se muestran {plural(lowStock.uniqueExcluded, "prenda única", "prendas únicas")}: tener una sola unidad es normal para ellas.
        </p>
      )}
      {lowStock.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay productos con stock bajo.</p>
      ) : (
        <ul className="divide-y text-sm">
          {lowStock.items.map((p) => (
            <li key={p.id}>
              <Link href={`/dashboard/productos/${p.id}`} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.category ?? "Sin categoría"} · <span className="font-mono">{p.sku}</span>
                    {p.unique ? " · prenda única" : ""}
                  </span>
                </span>
                <span className="rounded-full bg-amber/15 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-[#7a4f00]">{plural(p.stock, "unidad", "unidades")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {lowStock.total > lowStock.items.length && (
        <p className="text-xs text-muted-foreground">
          Mostrando {lowStock.items.length} de {lowStock.total}.
        </p>
      )}
    </Panel>
  );
}
