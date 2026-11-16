import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/common";
import { ProductForm } from "@/components/products/product-form";
import { getCategories, getDashboardContext, getProduct } from "@/lib/dal";

export const metadata: Metadata = { title: "Editar prenda" };

// Per-request page (reads the session through the API).
export const instant = false;

export default async function EditProductPage({ params }: PageProps<"/dashboard/productos/[id]/editar">) {
  const { id } = await params;
  const [{ subscription }, categories, product] = await Promise.all([getDashboardContext(), getCategories(), getProduct(id)]);
  if (!product) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Editar prenda" description={`${product.name} · ${product.sku}`} />
      <ProductForm
        mode="edit"
        product={product}
        categories={categories}
        aiUsage={null}
        productLimit={subscription.limits.products}
        canOperate={subscription.isOperational}
      />
    </div>
  );
}
