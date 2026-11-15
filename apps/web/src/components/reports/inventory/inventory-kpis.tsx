import { formatMoney, plural } from "@/lib/format";
import type { InventoryReport } from "@/types/reports";
import { KpiCard } from "../ui/kpi-card";

export function InventoryKpis({ stock, lowStock, value }: Pick<InventoryReport, "stock" | "value"> & { lowStock: number }) {
  return (
    <>
      <section aria-label="Stock actual" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Productos activos" value={String(stock.activeProducts)} />
        <KpiCard label="Unidades disponibles" value={String(stock.units)} tone="primary" />
        <KpiCard label="Productos agotados" value={String(stock.outOfStock)} />
        <KpiCard label="Con stock bajo" value={String(lowStock)} />
      </section>
      {value && (
        <section aria-label="Valor del inventario" className="grid grid-cols-2 gap-3">
          <KpiCard
            label={value.complete ? "Valor del inventario (costo)" : "Valor del inventario (parcial)"}
            value={formatMoney(value.costValue)}
            hint={
              value.complete
                ? "Unidades × costo de compra"
                : `${plural(value.unitsWithoutCost, "unidad", "unidades")} de ${plural(value.productsWithoutCost, "producto")} sin costo registrado`
            }
          />
          <KpiCard label="Valor a precio de venta" value={formatMoney(value.retailValue)} hint="Unidades × precio de venta actual" />
        </section>
      )}
    </>
  );
}
