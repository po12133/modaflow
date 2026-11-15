import Link from "next/link";
import type { InventoryReport } from "@/types/reports";
import { Panel } from "@modaflow/ui/components/panel";

export function InventoryOverview({ inventory, href }: { inventory: InventoryReport; href: string }) {
  const stats: [string, number][] = [
    ["Productos activos", inventory.stock.activeProducts],
    ["Unidades", inventory.stock.units],
    ["Agotados", inventory.stock.outOfStock],
    ["Stock bajo", inventory.lowStock.total],
  ];
  return (
    <Panel
      title="Inventario"
      action={
        <Link href={href} className="text-sm font-bold text-primary">
          Ver detalle
        </Link>
      }
    >
      <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-muted/60 px-2 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
            <dd className="text-xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
