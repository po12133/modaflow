import { notFound } from "next/navigation";
import { CatalogFilters } from "@/components/storefront/products/catalog-filters";
import { CategoryChips } from "@/components/storefront/products/category-chips";
import { ProductGrid } from "@/components/storefront/products/product-grid";
import { StoreHero } from "@/components/storefront/products/store-hero";
import { CATALOG_PAGE_SIZE } from "@/config/catalog";
import { searchParam as one } from "@modaflow/ui/lib/search-params";
import { getPublicCategories, getPublicProducts, getPublicStore } from "@/services/storefront";

export const instant = false;

const KEYS = ["search", "category", "size", "color", "minPrice", "maxPrice", "availability", "sort"] as const;

export default async function StorePage({ params, searchParams }: PageProps<"/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const store = await getPublicStore(slug);
  if (!store) notFound();
  const filters = Object.fromEntries(KEYS.map((k) => [k, one(sp[k])])) as Record<(typeof KEYS)[number], string | undefined>;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const [categories, products] = await Promise.all([getPublicCategories(slug), getPublicProducts(slug, { ...filters, page, pageSize: CATALOG_PAGE_SIZE })]);
  const base = `/${store.slug}`;
  const filtered = KEYS.some((k) => k !== "sort" && filters[k]);

  return (
    <div className="grid gap-4">
      {!filtered && page === 1 && <StoreHero store={store} />}
      <CatalogFilters values={filters} categories={categories} />
      <CategoryChips base={base} categories={categories} active={filters.category} />
      <ProductGrid page={products} base={base} params={filters} />
    </div>
  );
}
