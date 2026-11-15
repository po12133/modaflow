import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/dashboard/common";

export const metadata: Metadata = { title: "Vender" };

// Per-request page (reads the session through the API).
export const instant = false;

export default function SellPage() {
  return (
    <>
      <PageHeader title="Vender" />
      <ComingSoon
        title="Punto de venta"
        description="Pronto podrás registrar ventas en segundos, con descuento automático del inventario."
      />
    </>
  );
}
