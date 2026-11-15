import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/common";
import { MOVEMENT_LABELS, MovementList } from "@/components/inventory/movement-list";
import { Pagination } from "@modaflow/ui/components/pagination";
import { InventoryTabs } from "@/components/products/inventory-tabs";
import { api } from "@/lib/api";
import type { Movement, MovementType, Paginated } from "@/lib/types";
import { cn } from "@modaflow/ui/lib/utils";

export const metadata: Metadata = { title: "Movimientos" };

// Per-request page (reads the session through the API).
export const instant = false;

const TYPES = Object.keys(MOVEMENT_LABELS) as MovementType[];
const UUID = /^[0-9a-f-]{36}$/i;

export default async function MovementsPage({ searchParams }: PageProps<"/dashboard/inventario/movimientos">) {
  const raw = await searchParams;
  const type = typeof raw.type === "string" && TYPES.includes(raw.type as MovementType) ? raw.type : undefined;
  const productId = typeof raw.productId === "string" && UUID.test(raw.productId) ? raw.productId : undefined;
  const page = typeof raw.page === "string" && /^\d+$/.test(raw.page) ? raw.page : undefined;

  const qs = new URLSearchParams({ pageSize: "30" });
  if (type) qs.set("type", type);
  if (productId) qs.set("productId", productId);
  if (page) qs.set("page", page);
  const list = await api<Paginated<Movement>>(`/inventory/movements?${qs}`);

  const chip = (value: string | undefined, label: string) => {
    const p = new URLSearchParams();
    if (value) p.set("type", value);
    if (productId) p.set("productId", productId);
    const s = p.toString();
    return (
      <Link
        key={label}
        href={s ? `/dashboard/inventario/movimientos?${s}` : "/dashboard/inventario/movimientos"}
        aria-current={type === value ? "true" : undefined}
        className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold", type === value ? "border-primary bg-primary text-white" : "bg-card text-ink-2")}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="grid gap-1">
      <PageHeader title="Inventario" description="Historial de entradas, salidas y ajustes." />
      <InventoryTabs />
      {productId && list.items[0] && (
        <p className="mb-2 text-sm">
          Producto: <b>{list.items[0].product.name}</b> ·{" "}
          <Link href="/dashboard/inventario/movimientos" className="font-semibold text-primary">
            ver todos
          </Link>
        </p>
      )}
      <nav aria-label="Tipo de movimiento" className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {chip(undefined, "Todos")}
        {TYPES.map((t) => chip(t, MOVEMENT_LABELS[t]))}
      </nav>
      <MovementList movements={list.items} />
      <Pagination
        basePath="/dashboard/inventario/movimientos"
        params={{ type, productId }}
        page={list.page}
        totalPages={list.totalPages}
        total={list.total}
        noun="movimientos"
      />
    </div>
  );
}
