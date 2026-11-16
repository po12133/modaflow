import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { catalogQuery } from "@/lib/catalog";
import { getPublicCategories } from "@/services/storefront";

export const metadata: Metadata = { title: "Categorías" };

export const instant = false;

export default async function CategoriesPage({ params }: PageProps<"/[slug]/categorias">) {
  const { slug } = await params;
  const categories = await getPublicCategories(slug);
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Categorías</h1>
      {categories.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">Todavía no hay prendas publicadas.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/${slug}${catalogQuery({ category: c.slug })}`} className="flex items-center justify-between rounded-2xl border bg-white p-4 font-bold">
                <span>
                  {c.name}
                  <span className="block text-xs font-semibold text-muted-foreground">{c.products} {c.products === 1 ? "prenda" : "prendas"}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
