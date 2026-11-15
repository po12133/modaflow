import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/common";
import { CategoryManager } from "@/components/products/category-manager";
import { getCategories, getDashboardContext } from "@/lib/dal";

export const metadata: Metadata = { title: "Categorías" };

// Per-request page (reads the session through the API).
export const instant = false;

export default async function CategoriesPage() {
  const [{ me, subscription }, categories] = await Promise.all([getDashboardContext(), getCategories()]);
  const isAdmin = me.membership.role === "OWNER" || me.membership.role === "ADMIN";
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-1">
      <Link href="/dashboard/productos" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ChevronLeft className="size-4" aria-hidden="true" /> Productos
      </Link>
      <PageHeader title="Categorías" description="Organiza tus prendas. No se permiten nombres repetidos." />
      <CategoryManager categories={categories} canCreate={subscription.isOperational} canEdit={isAdmin && subscription.isOperational} />
    </div>
  );
}
