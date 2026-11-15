import Link from "next/link";
import { X } from "lucide-react";
import { PRODUCT_SORTS } from "@/config/reports";
import type { Category } from "@/lib/types";
import { UrlChips, UrlSearch, UrlSelect } from "../controls/url-fields";

export interface ProductFilterValues {
  categoryId?: string;
  productId?: string;
  search?: string;
  sort?: string;
}

interface ProductFiltersProps {
  values: ProductFilterValues;
  categories: Category[];
  productName?: string;
  clearProductHref: string;
}

export function ProductFilters({ values, categories, productName, clearProductHref }: ProductFiltersProps) {
  return (
    <>
      <UrlChips name="sort" label="Ordenar" value={values.sort ?? "units_desc"} options={PRODUCT_SORTS} />
      <div className="grid grid-cols-2 gap-2">
        <UrlSelect name="categoryId" label="Categoría" value={values.categoryId ?? ""} options={[["", "Todas"], ...categories.map((c) => [c.id, c.name] as [string, string])]} />
        <div className="grid min-w-0 gap-1 text-xs font-semibold text-ink-2">
          Producto
          <UrlSearch name="search" label="Buscar producto" placeholder="Nombre" value={values.search ?? ""} />
        </div>
      </div>
      {values.productId && (
        <p className="flex items-center gap-2 text-sm">
          Variantes de <b>{productName ?? "un producto"}</b>
          <Link href={clearProductHref} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
            <X className="size-3" aria-hidden="true" /> Quitar filtro
          </Link>
        </p>
      )}
    </>
  );
}
