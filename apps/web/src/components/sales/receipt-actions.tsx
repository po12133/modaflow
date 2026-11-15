"use client";

import { Download, LinkIcon, LoaderCircle, Printer, Share2, Unlink } from "lucide-react";
import { useState, useTransition } from "react";
import { createReceiptLinkAction, revokeReceiptLinkAction } from "@/actions/sales";
import { formatMoney, PAYMENT_LABELS } from "@modaflow/ui/lib/format";
import type { Receipt } from "@/lib/types";
import { WhatsAppIcon } from "@/components/common/whatsapp-icon";

/**
 * Receipt actions. Sharing uses a random, revocable public link (the dashboard
 * URL would not open on the customer's phone).
 */
export function ReceiptActions({
  saleId,
  receipt,
  initialPath,
  canRevoke,
}: {
  saleId: string;
  receipt: Receipt;
  initialPath: string | null;
  canRevoke: boolean;
}) {
  const [path, setPath] = useState(initialPath);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function ensureLink(): Promise<string | null> {
    if (path) return `${window.location.origin}${path}`;
    const result = await createReceiptLinkAction(saleId);
    if (!result.ok) {
      setMessage(result.message);
      return null;
    }
    setPath(result.data.path);
    return `${window.location.origin}${result.data.path}`;
  }

  function summaryText(url: string) {
    const lines = receipt.items.map((i) => `• ${i.quantity} × ${i.productName}${i.size ? ` (${i.size})` : ""}: ${formatMoney(i.lineTotal)}`);
    return [
      `*${receipt.store.name}*`,
      `Comprobante ${receipt.number}${receipt.status === "CANCELED" ? " (ANULADA)" : ""}`,
      ...lines,
      `*Total: ${formatMoney(receipt.total)}* · ${PAYMENT_LABELS[receipt.paymentMethod]}`,
      "",
      `Ver comprobante: ${url}`,
      "Comprobante interno, no es factura fiscal.",
    ].join("\n");
  }

  function shareWhatsApp() {
    setMessage(null);
    // Open the window synchronously (popup blockers), then fill the URL.
    const win = window.open("", "_blank");
    startTransition(async () => {
      const url = await ensureLink();
      if (!url) {
        win?.close();
        return;
      }
      const wa = `https://wa.me/?text=${encodeURIComponent(summaryText(url))}`;
      if (win) win.location.href = wa;
      else window.location.href = wa;
    });
  }

  function shareNative() {
    setMessage(null);
    startTransition(async () => {
      const url = await ensureLink();
      if (!url) return;
      if (navigator.share) {
        try {
          await navigator.share({ title: `Comprobante ${receipt.number}`, text: summaryText(url), url });
        } catch {
          /* cancelled by the user */
        }
      } else {
        await navigator.clipboard?.writeText(url);
        setMessage("Enlace copiado.");
      }
    });
  }

  function revoke() {
    setMessage(null);
    startTransition(async () => {
      const result = await revokeReceiptLinkAction(saleId);
      if (result.ok) {
        setPath(null);
        setMessage("Enlace desactivado: quien lo tenga ya no podrá abrirlo.");
      } else setMessage(result.message);
    });
  }

  const button = "flex h-12 items-center justify-center gap-2 rounded-xl border bg-card text-sm font-bold";
  return (
    <div className="grid gap-2 print:hidden">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={shareWhatsApp} disabled={pending} className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1fa855] text-sm font-bold text-white">
          {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <WhatsAppIcon />} Compartir por WhatsApp
        </button>
        <a href={`/api/sales/${saleId}/receipt-pdf?download=1`} className={button}>
          <Download className="size-5" aria-hidden="true" /> Descargar PDF
        </a>
        <button type="button" onClick={() => window.print()} className={button}>
          <Printer className="size-5" aria-hidden="true" /> Imprimir
        </button>
        <button type="button" onClick={shareNative} disabled={pending} className={`${button} col-span-2`}>
          <Share2 className="size-5" aria-hidden="true" /> Compartir…
        </button>
      </div>
      {path && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <LinkIcon className="size-3.5" aria-hidden="true" /> Enlace público activo
          {canRevoke && (
            <button type="button" onClick={revoke} disabled={pending} className="ml-auto inline-flex items-center gap-1 font-bold text-destructive">
              <Unlink className="size-3.5" aria-hidden="true" /> Desactivar
            </button>
          )}
        </div>
      )}
      {message && <p role="status" className="text-sm font-semibold text-ink-2">{message}</p>}
    </div>
  );
}
