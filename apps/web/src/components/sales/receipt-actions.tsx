"use client";

import { Download, LinkIcon, LoaderCircle, Printer, Share2, Unlink } from "lucide-react";
import { useState, useTransition } from "react";
import { createReceiptLinkAction, revokeReceiptLinkAction } from "@/actions/sales";
import { formatMoney, PAYMENT_LABELS } from "@/lib/format";
import type { Receipt } from "@/lib/types";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.2 8.2 0 0 1-2.4-1.5 9 9 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.4-.5.3-.5v-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c.7.3 1.3.5 1.7.6a4.2 4.2 0 0 0 1.9.1 3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3ZM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4a9.8 9.8 0 1 1 8.3 4.6ZM20.4 3.6A11.8 11.8 0 0 0 1.9 17.8L.2 24l6.3-1.7a11.8 11.8 0 0 0 5.6 1.4A11.8 11.8 0 0 0 20.4 3.6Z" />
    </svg>
  );
}

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
