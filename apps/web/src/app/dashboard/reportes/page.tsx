import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/dashboard/common";

export const metadata: Metadata = { title: "Reportes" };

// Per-request page (reads the session through the API).
export const instant = false;

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reportes" />
      <ComingSoon
        title="Reportes del negocio"
        description="Pronto verás tus ventas, productos más vendidos y ganancias, con datos reales de tu tienda."
      />
    </>
  );
}
