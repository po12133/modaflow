import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PublishList } from "@/components/catalog-admin/publish-list";
import { PageHeader } from "@/components/dashboard/common";
import { Pagination } from "@/components/pagination";
import { getDashboardContext } from "@/lib/dal";
import { searchParam as one } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { getCatalogProducts, getCatalogSettings } from "@/services/catalog";

export const metadata: Metadata = { title: "Productos del catálogo" };

export const instant = false;

const TABS: [string, string][] = [["", "Todos"], ["published", "Publicados"], ["hidden", "Ocultos"]];

export default async function CatalogProductsPage({ searchParams }: PageProps<"/dashboard/catalogo/productos">) {
  const [{ me }, sp, settings] = await Promise.all([getDashboardContext(), searchParams, getCatalogSettings()]);
  const filters = { visibility: one(sp.visibility), search: one(sp.search) };
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const data = await getCatalogProducts({ ...filters, page });
  const canEdit = settings.planAllowsCatalog && me.membership.role !== "SELLER";
  return (
    <div className="grid gap-4">
      <Link href="/dashboard/catalogo" className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold text-primary">
        <ChevronLeft className="size-4" aria-hidden="true" /> Catálogo
      </Link>
      <PageHeader title="Productos del catálogo" description="Publicar u ocultar no cambia el stock ni el estado del producto." />
      <nav aria-label="Filtrar" className="flex gap-2">
        {TABS.map(([v, l]) => (
          <Link key={v} href={v ? `?visibility=${v}` : "?"} aria-current={(filters.visibility ?? "") === v ? "page" : undefined} className={cn("h-9 rounded-full border px-3.5 text-sm leading-9 font-semibold", (filters.visibility ?? "") === v ? "border-foreground bg-foreground text-white" : "bg-card")}>
            {l}
          </Link>
        ))}
      </nav>
      <form method="get" role="search">
        {filters.visibility && <input type="hidden" name="visibility" value={filters.visibility} />}
        <input type="search" name="search" defaultValue={filters.search} placeholder="Buscar por nombre o SKU" aria-label="Buscar productos" className="h-11 w-full rounded-xl border border-input bg-card px-3 text-base md:text-sm" />
      </form>
      {!settings.planAllowsCatalog && <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm">Tu plan no incluye el catálogo online: puedes ver tus productos, pero no publicarlos.</p>}
      {data.items.length === 0 ? <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">No hay productos con estos filtros.</p> : <PublishList items={data.items} canEdit={canEdit} />}
      <Pagination basePath="/dashboard/catalogo/productos" params={filters} page={data.page} totalPages={data.totalPages} total={data.total} noun="productos" />
    </div>
  );
}
