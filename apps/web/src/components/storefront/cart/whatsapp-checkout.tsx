"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { createOrderRequestAction, markWhatsappOpenedAction } from "@/actions/storefront";
import { WhatsAppIcon } from "@/components/common/whatsapp-icon";
import { formatMoney } from "@/lib/format";
import type { OrderIssue, OrderRequestResult } from "@/types/catalog";
import { useCart } from "./cart-provider";

export function WhatsappCheckout() {
  const { slug, lines, setMax, clear } = useCart();
  const [result, setResult] = useState<OrderRequestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [pending, start] = useTransition();

  function prepare() {
    setError(null);
    start(async () => {
      const res = await createOrderRequestAction({ slug, items: lines.map((l) => ({ productSlug: l.productSlug, sku: l.sku, quantity: l.quantity })) });
      if (res.ok) return setResult(res.data);
      const issues = Array.isArray(res.details) ? (res.details as OrderIssue[]) : [];
      for (const issue of issues) {
        const line = lines[issue.index];
        if (line) setMax(line.sku, issue.code === "INSUFFICIENT_STOCK" ? issue.available : 0);
      }
      setError(issues.length ? "Actualizamos tu carrito: algunas prendas ya no están disponibles en esa cantidad. Revísalo e intenta de nuevo." : res.message);
    });
  }

  if (!result) {
    return (
      <div className="grid gap-2">
        {error && (
          <p role="alert" className="rounded-xl bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
        <button type="button" onClick={prepare} disabled={pending || lines.length === 0} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#1fa855] font-bold text-white disabled:opacity-50">
          {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <WhatsAppIcon />} Pedir por WhatsApp
        </button>
        <p className="text-center text-xs text-muted-foreground">No necesitas registrarte. Revisarás el mensaje antes de enviarlo.</p>
      </div>
    );
  }

  return (
    <section aria-label="Mensaje para la tienda" className="grid gap-3 rounded-2xl border bg-white p-4">
      <h2 className="font-extrabold">Revisa tu mensaje</h2>
      <pre className="max-h-72 overflow-auto rounded-xl bg-muted/60 p-3 font-sans text-sm whitespace-pre-wrap">{result.message}</pre>
      <p className="text-sm">
        Total referencial: <b>{formatMoney(result.total)}</b>
      </p>
      <a
        href={result.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          setOpened(true);
          void markWhatsappOpenedAction(slug, result.code, result.token);
        }}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#1fa855] font-bold text-white"
      >
        <WhatsAppIcon /> Abrir WhatsApp
      </a>
      {opened && (
        <div role="status" className="grid gap-2 rounded-xl bg-muted/60 p-3 text-sm">
          <p>Envía el mensaje en WhatsApp. La tienda confirmará disponibilidad y forma de pago; tu pedido no está reservado hasta que respondan.</p>
          <button type="button" onClick={() => { clear(); setResult(null); setOpened(false); }} className="h-10 rounded-xl border bg-white font-bold">
            Vaciar carrito
          </button>
        </div>
      )}
      <button type="button" onClick={() => setResult(null)} className="text-sm font-semibold text-muted-foreground underline">
        Volver al carrito
      </button>
    </section>
  );
}
