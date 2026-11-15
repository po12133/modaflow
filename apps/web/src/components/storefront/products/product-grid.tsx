import { Pagination } from "@/components/pagination";
import type { PublicProductPage } from "@/types/catalog";
import { ProductCard } from "./product-card";

export function ProductGrid({ page, base, params }: { page: PublicProductPage; base: string; params: Record<string, string | undefined> }) {
  if (page.items.length === 0) {
    return <p className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">No encontramos prendas con esos filtros.</p>;
  }
  return (
    <section aria-label="Prendas" className="grid gap-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {page.items.map((p, i) => (
          <li key={p.slug}>
            <ProductCard product={p} base={base} priority={page.page === 1 && i < 4} />
          </li>
        ))}
      </ul>
      <Pagination basePath={base} params={params} page={page.page} totalPages={page.totalPages} total={page.total} noun="prendas" />
    </section>
  );
}
