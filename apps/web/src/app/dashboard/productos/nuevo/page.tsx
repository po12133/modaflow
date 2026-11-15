import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/common";
import { ProductForm } from "@/components/products/product-form";
import { getAiUsage, getCategories, getDashboardContext } from "@/lib/dal";

export const metadata: Metadata = { title: "Registrar prenda" };

// Per-request page (reads the session through the API).
export const instant = false;

export default async function NewProductPage() {
  const [{ subscription }, categories, aiUsage] = await Promise.all([
    getDashboardContext(),
    getCategories(),
    getAiUsage().catch(() => null),
  ]);
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Registrar prenda" description="Toma una foto, deja que la IA complete los datos y agrega el precio y la cantidad." />
      <ProductForm
        mode="create"
        categories={categories}
        aiUsage={aiUsage}
        productLimit={subscription.limits.products}
        canOperate={subscription.isOperational}
      />
    </div>
  );
}
