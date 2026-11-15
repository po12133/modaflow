import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/dashboard/common";

export const metadata: Metadata = { title: "Inventario" };

// Per-request page (reads the session through the API).
export const instant = false;

export default function InventoryPage() {
  return (
    <>
      <PageHeader title="Inventario" />
      <ComingSoon
        title="Inventario y registro de prendas"
        description="Pronto podrás registrar prendas con fotos e IA, y controlar tallas, colores y stock."
      />
    </>
  );
}
