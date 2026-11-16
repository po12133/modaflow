import type { Metadata } from "next";
import Link from "next/link";
import { ImageOff, Plus, Tags } from "lucide-react";
import { PageHeader } from "@/components/dashboard/common";
import { DeletedNotice } from "@/components/products/deleted-notice";
import { Pagination } from "@modaflow/ui/components/pagination";
import { InventoryTabs } from "@/components/products/inventory-tabs";
import { type FilterValues, ProductFilters } from "@/components/products/product-filters";
import { StockBadge } from "@/components/products/stock-badge";
import { Button } from "@modaflow/ui/components/ui/button";
import { api } from "@/lib/api";
import { getCategories, getDashboardContext } from "@/lib/dal";
import { formatNumber, formatMoney } from "@modaflow/ui/lib/format";
import type { Paginated, ProductListItem } from "@/lib/types";

export const metadata: Metadata = { title: "Productos" };

// Per-request page (reads the session through the API).
export const instant = false;

const KEYS = ["search", "categoryId", "color", "size", "availability", "sort", "page"] as const;

function pick(params: Record<string, string | string[] | undefined>) {
  const out: Record<string, string | undefined> = {};
  for (const k of KEYS) {
    const v = params[k];
    out[k] = typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : undefined;
  }
  return out;
}


export default async function ProductsPage({ searchParams }: PageProps<"/dashboard/productos">) {
  const raw = await searchParams;
  const params = pick(raw);
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  qs.set("pageSize", "20");
  const [{ subscription }, categories, list] = await Promise.all([
    getDashboardContext(),
    getCategories(),
    api<Paginated<ProductListItem>>(`/products?${qs}`),
  ]);
  const { used, limit } = subscription.limits.products;
  const filtering = Boolean(params.search || params.categoryId || params.color || params.size || params.availability);

  return (
    <div className="grid gap-1">
      {raw.eliminado === "1" && <DeletedNotice />}
      <PageHeader
        title="Inventario"
        description={`${formatNumber(used)} de ${formatNumber(limit)} productos de tu plan`}
        action={
          <Button asChild size="lg" className="h-11 bg-brand-gradient font-bold">
            <Link href="/dashboard/productos/nuevo">
              <Plus aria-hidden="true" /> Registrar prenda
            </Link>
          </Button>
        }
      />
      <InventoryTabs />
      <ProductFilters values={params as FilterValues} categories={categories} />

      {list.items.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
          <p className="font-bold">{filtering ? "No encontramos productos con esos filtros." : "Todavía no registraste prendas."}</p>
          {!filtering && (
            <Button asChild size="lg" className="mt-4 h-11">
              <Link href="/dashboard/productos/nuevo">Registrar la primera prenda</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="grid grid-cols-2 gap-3 lg:hidden">
            {list.items.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/productos/${p.id}`} className="block overflow-hidden rounded-2xl border bg-card shadow-sm active:scale-[0.99]">
                  <div className="relative aspect-[4/5] bg-muted">
                    {p.image?.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
                      <img src={p.image.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center text-muted-foreground">
                        <ImageOff className="size-6" aria-hidden="true" />
                      </span>
                    )}
                    <StockBadge status={p.stockStatus} units={p.totalStock} className="absolute bottom-2 left-2 shadow" />
                  </div>
                  <div className="grid gap-0.5 p-2.5">
                    <p className="line-clamp-2 text-sm leading-tight font-bold">{p.name}</p>
                    <p className="text-base font-extrabold text-primary">{formatMoney(p.salePrice)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.sizes.length ? p.sizes.join(" · ") : "Talla única", p.color].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-sm lg:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Productos</caption>
              <thead className="bg-[#fbfaff] text-left text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">Producto</th>
                  <th scope="col" className="px-3 py-3">Categoría</th>
                  <th scope="col" className="px-3 py-3">Tallas</th>
                  <th scope="col" className="px-3 py-3">Color</th>
                  <th scope="col" className="px-3 py-3 text-right">Precio</th>
                  <th scope="col" className="px-3 py-3">Stock</th>
                  <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {p.image?.thumbUrl && (
                            // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
                            <img src={p.image.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <Link href={`/dashboard/productos/${p.id}`} className="block truncate font-bold hover:text-primary">{p.name}</Link>
                          <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.category?.name ?? "—"}</td>
                    <td className="px-3 py-2.5">{p.sizes.length ? p.sizes.join(", ") : "Única"}</td>
                    <td className="px-3 py-2.5">{p.color ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right font-bold">{formatMoney(p.salePrice)}</td>
                    <td className="px-3 py-2.5"><StockBadge status={p.stockStatus} units={p.totalStock} /></td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/dashboard/productos/${p.id}`} className="font-semibold text-primary">Ver</Link>
                      <Link href={`/dashboard/productos/${p.id}/editar`} className="ml-3 font-semibold text-primary">Editar</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination basePath="/dashboard/productos" params={params} page={list.page} totalPages={list.totalPages} total={list.total} noun="productos" />
        </>
      )}

      <Link href="/dashboard/productos/categorias" className="mt-4 inline-flex items-center gap-2 justify-self-start text-sm font-semibold text-primary">
        <Tags className="size-4" aria-hidden="true" /> Administrar categorías
      </Link>
    </div>
  );
}
