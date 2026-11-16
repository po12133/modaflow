import type { Metadata } from "next";
import Link from "next/link";
import { CircleX, Package, Plus, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/dashboard/common";
import { MovementDialog } from "@/components/inventory/movement-dialog";
import { Pagination } from "@modaflow/ui/components/pagination";
import { InventoryTabs } from "@/components/products/inventory-tabs";
import { type FilterValues, ProductFilters } from "@/components/products/product-filters";
import { StockBadge } from "@/components/products/stock-badge";
import { Button } from "@modaflow/ui/components/ui/button";
import { api } from "@/lib/api";
import { getCategories, getDashboardContext } from "@/lib/dal";
import { formatNumber, variantLabel } from "@modaflow/ui/lib/format";
import type { InventoryResponse } from "@/lib/types";
import { cn } from "@modaflow/ui/lib/utils";

export const metadata: Metadata = { title: "Stock" };

// Per-request page (reads the session through the API).
export const instant = false;

export default async function InventoryPage({ searchParams }: PageProps<"/dashboard/inventario">) {
  const raw = await searchParams;
  const params: Record<string, string | undefined> = {};
  for (const k of ["search", "categoryId", "availability", "page"]) {
    const v = raw[k];
    params[k] = typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : undefined;
  }
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  const [{ me, subscription }, categories, inv] = await Promise.all([
    getDashboardContext(),
    getCategories(),
    api<InventoryResponse>(`/inventory?${qs}`),
  ]);
  const canAdmin = me.membership.role === "OWNER" || me.membership.role === "ADMIN";

  const kpis = [
    { label: "Unidades en tienda", value: inv.summary.units, sub: `${inv.summary.products} productos`, icon: Package, tone: "bg-secondary text-primary", filter: undefined },
    { label: "Stock bajo", value: inv.summary.lowStock, sub: "Ver productos", icon: TriangleAlert, tone: "bg-amber/15 text-[#a2620a]", filter: "low_stock" },
    { label: "Agotados", value: inv.summary.outOfStock, sub: "Ver productos", icon: CircleX, tone: "bg-destructive/10 text-destructive", filter: "out_of_stock" },
  ];

  return (
    <div className="grid gap-1">
      <PageHeader
        title="Inventario"
        description="Existencias reales por prenda y talla."
        action={
          <Button asChild size="lg" className="h-11 bg-brand-gradient font-bold">
            <Link href="/dashboard/productos/nuevo">
              <Plus aria-hidden="true" /> Registrar prenda
            </Link>
          </Button>
        }
      />
      <InventoryTabs />

      <div className="mb-4 grid grid-cols-3 gap-2">
        {kpis.map(({ label, value, sub, icon: Icon, tone, filter }) => (
          <Link
            key={label}
            href={filter ? `/dashboard/inventario?availability=${filter}` : "/dashboard/inventario"}
            aria-current={params.availability === filter ? "true" : undefined}
            className={cn("grid gap-1 rounded-2xl border bg-card p-3 shadow-sm", params.availability === filter && filter && "border-primary")}
          >
            <span className={cn("grid size-8 place-items-center rounded-lg", tone)}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">{label}</span>
            <span className="text-xl font-extrabold">{formatNumber(value)}</span>
            <span className="hidden text-xs text-muted-foreground sm:block">{sub}</span>
          </Link>
        ))}
      </div>

      <ProductFilters values={params as FilterValues} categories={categories} showSort={false} />

      {inv.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">No hay productos para mostrar.</p>
      ) : (
        <ul className="grid gap-3">
          {inv.items.map((p) => (
            <li key={p.id} className="rounded-2xl border bg-card p-3.5 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/dashboard/productos/${p.id}`} className="block truncate font-bold hover:text-primary">
                    {p.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{p.sku}</span>
                    {p.category && ` · ${p.category}`}
                  </p>
                </div>
                <StockBadge status={p.stockStatus} units={p.totalStock} />
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {p.variants.map((v) => (
                  <li key={v.id}>
                    {subscription.isOperational ? (
                      <MovementDialog
                        variants={p.variants}
                        defaultVariantId={v.id}
                        canAdjust={canAdmin}
                        trigger={
                          <button type="button" className={cn("rounded-lg border px-2.5 py-1.5 text-sm font-semibold", v.stock === 0 ? "border-destructive/30 bg-destructive/5 text-destructive" : "bg-muted/60")} aria-label={`${variantLabel(v)}: ${v.stock} en stock. Registrar movimiento`}>
                            {variantLabel(v)} <b className="ml-1">{v.stock}</b>
                          </button>
                        }
                      />
                    ) : (
                      <span className="rounded-lg border bg-muted/60 px-2.5 py-1.5 text-sm font-semibold">
                        {variantLabel(v)} <b className="ml-1">{v.stock}</b>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <Pagination basePath="/dashboard/inventario" params={params} page={inv.page} totalPages={inv.totalPages} total={inv.total} noun="productos" />
    </div>
  );
}
