import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { LogoMark } from "@modaflow/ui/components/brand";
import { ReceiptView } from "@/components/sales/receipt-view";
import { api, ApiError } from "@/lib/api";
import type { Receipt } from "@/lib/types";

export const metadata: Metadata = {
  title: "Comprobante de venta",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Rendered per request (not streamed) so revoked or unknown links answer a real 404.
export const instant = false;

async function PublicReceipt({ params }: { params: PageProps<"/boleta/[token]">["params"] }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  let receipt: Receipt;
  try {
    receipt = await api<Receipt>(`/receipts/${token}`, { auth: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return (
    <>
      <ReceiptView receipt={receipt} />
      <a
        href={`/api/receipts/${token}/pdf?download=1`}
        className="mx-auto flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white print:hidden"
      >
        <Download className="size-5" aria-hidden="true" /> Descargar PDF
      </a>
    </>
  );
}

/** Public receipt opened by the customer from a shared link (no login). */
export default function PublicReceiptPage({ params }: PageProps<"/boleta/[token]">) {
  return (
    <main className="grid min-h-dvh content-start gap-4 bg-[#f6f5fb] px-4 py-6">
      <PublicReceipt params={params} />
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground print:hidden">
        <LogoMark className="size-4" /> Generado con ModaFlow
      </p>
    </main>
  );
}
