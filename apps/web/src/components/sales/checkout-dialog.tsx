"use client";

import { Banknote, CircleAlert, CreditCard, LoaderCircle, QrCode, Send, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createSaleAction, previewSaleAction } from "@/actions/sales";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatMoney, PAYMENT_LABELS, variantLabel } from "@/lib/format";
import { fromCents, toCents } from "@/lib/sale-math";
import type { Discount, PaymentMethod, SalePreview } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { CartLine } from "./pos-client";

const METHODS: { value: PaymentMethod; icon: typeof Banknote }[] = [
  { value: "CASH", icon: Banknote },
  { value: "QR", icon: QrCode },
  { value: "TRANSFER", icon: Send },
  { value: "OTHER", icon: Wallet },
];

export function CheckoutDialog({
  open,
  onOpenChange,
  cart,
  general,
  storeName,
  onSold,
  onStockChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartLine[];
  general: Discount | null;
  storeName: string;
  onSold: () => void;
  onStockChanged: (variantId: string, available: number) => void;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<SalePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, startPreview] = useTransition();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [received, setReceived] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  /** One key per checkout (the dialog mounts per opening): retries never create a second sale. */
  const idempotencyKey = useRef(crypto.randomUUID().replace(/-/g, ""));

  const items = cart.map((l) => ({
    variantId: l.variantId,
    quantity: l.quantity,
    discount: l.discount && l.discount.value.trim() ? l.discount : null,
  }));
  const generalDiscount = general && general.value.trim() ? general : null;

  useEffect(() => {
    startPreview(async () => {
      const result = await previewSaleAction({ items, discount: generalDiscount });
      if (result.ok) setPreview(result.data);
      else setPreviewError(result.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- server preview once per opening
  }, []);

  const totalCents = preview ? toCents(preview.total) : 0;
  let receivedCents: number | null = null;
  try {
    receivedCents = received.trim() ? toCents(received) : null;
  } catch {
    receivedCents = -1;
  }
  const cashInvalid = method === "CASH" && receivedCents !== null && (receivedCents < 0 || receivedCents < totalCents);
  const change = method === "CASH" && receivedCents !== null && receivedCents >= totalCents ? receivedCents - totalCents : null;
  const canConfirm = Boolean(preview?.canConfirm && method && confirmed && !cashInvalid && !saving);

  function confirm() {
    if (!method || !preview) return;
    setError(null);
    startSaving(async () => {
      const result = await createSaleAction({
        items,
        discount: generalDiscount,
        paymentMethod: method,
        amountReceived: method === "CASH" && received.trim() ? received.trim().replace(",", ".") : undefined,
        paymentConfirmed: true,
        idempotencyKey: idempotencyKey.current,
      });
      if (!result.ok) {
        setError(result.message);
        if (result.code === "INSUFFICIENT_STOCK" && result.variantId && result.available !== undefined) {
          onStockChanged(result.variantId, result.available);
        }
        return;
      }
      onSold();
      onOpenChange(false);
      router.push(`/dashboard/ventas/${result.data.id}/boleta?nueva=1`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="top-auto bottom-0 left-0 max-h-[94dvh] w-full max-w-full translate-x-0 translate-y-0 overflow-y-auto rounded-b-none sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader>
          <DialogTitle>Confirmar venta</DialogTitle>
          <DialogDescription>{storeName} · revisa el resumen y el método de pago.</DialogDescription>
        </DialogHeader>

        {loadingPreview && (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Verificando precios y stock…
          </p>
        )}
        {previewError && <p role="alert" className="rounded-xl bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive">{previewError}</p>}

        {preview && (
          <div className="grid gap-4">
            <ul className="grid gap-1.5 text-sm">
              {preview.items.map((item) => (
                <li key={item.variantId} className="flex justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {item.quantity} × {item.productName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {variantLabel(item)}
                      {Number(item.unitDiscount) > 0 && ` · desc. ${formatMoney(item.unitDiscount)} c/u`}
                    </span>
                  </span>
                  <b>{formatMoney(item.lineTotal)}</b>
                </li>
              ))}
            </ul>
            {preview.issues.length > 0 && (
              <div role="alert" className="grid gap-1 rounded-xl bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive">
                {preview.issues.map((i) => (
                  <p key={i.variantId} className="flex gap-2">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {i.message}
                  </p>
                ))}
                <p className="font-normal">Ajusta la venta antes de confirmar.</p>
              </div>
            )}
            <dl className="grid gap-1 rounded-xl bg-muted/60 p-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(preview.subtotal)}</dd></div>
              {Number(preview.itemsDiscount) > 0 && <div className="flex justify-between text-[#0b7a66]"><dt>Descuentos por prenda</dt><dd>- {formatMoney(preview.itemsDiscount)}</dd></div>}
              {Number(preview.discountAmount) > 0 && <div className="flex justify-between text-[#0b7a66]"><dt>Descuento general</dt><dd>- {formatMoney(preview.discountAmount)}</dd></div>}
              <div className="flex justify-between border-t pt-1.5 text-xl font-extrabold"><dt>Total</dt><dd>{formatMoney(preview.total)}</dd></div>
            </dl>

            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-semibold text-ink-2">Método de pago</legend>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map(({ value, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMethod(value)}
                    aria-pressed={method === value}
                    className={cn(
                      "flex h-14 items-center justify-center gap-2 rounded-xl border text-sm font-bold",
                      method === value ? "border-primary bg-secondary text-violet-strong" : "bg-card text-ink-2",
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" /> {PAYMENT_LABELS[value]}
                  </button>
                ))}
              </div>
            </fieldset>

            {method === "CASH" && (
              <div className="grid gap-2">
                <label htmlFor="received" className="text-sm font-semibold text-ink-2">
                  Monto recibido <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Input id="received" inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={fromCents(totalCents)} aria-invalid={cashInvalid} className="h-12 text-lg font-bold" />
                <div className="flex flex-wrap gap-2">
                  {[totalCents, 5000, 10000, 20000].filter((v, i, a) => v >= totalCents && a.indexOf(v) === i).map((v) => (
                    <button key={v} type="button" onClick={() => setReceived(fromCents(v))} className="h-9 rounded-lg border bg-card px-3 text-sm font-semibold">
                      {v === totalCents ? "Exacto" : formatMoney(fromCents(v))}
                    </button>
                  ))}
                </div>
                {cashInvalid && <p className="text-xs font-semibold text-destructive">El monto recibido es menor al total.</p>}
                {change !== null && (
                  <p className="rounded-xl bg-mint/10 px-3 py-2 text-base font-extrabold text-[#0b7a66]" aria-live="polite">
                    Cambio: {formatMoney(fromCents(change))}
                  </p>
                )}
              </div>
            )}
            {method === "QR" && (
              <p className="flex items-start gap-2 rounded-xl bg-[#e7efff] px-3 py-2 text-sm text-[#2357b8]">
                <QrCode className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Muestra el QR de tu banco y verifica en tu celular que el pago llegó antes de confirmar.
              </p>
            )}
            {method === "TRANSFER" && (
              <p className="flex items-start gap-2 rounded-xl bg-[#e7efff] px-3 py-2 text-sm text-[#2357b8]">
                <CreditCard className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Verifica que la transferencia llegó a tu cuenta antes de confirmar.
              </p>
            )}

            <label className="flex items-start gap-3 rounded-xl border p-3 text-sm font-semibold">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-5 accent-[#6c4cf5]" />
              Confirmo que recibí el pago de {formatMoney(preview.total)}.
            </label>

            {error && (
              <p role="alert" className="rounded-xl bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={confirm}
              disabled={!canConfirm}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-extrabold text-white shadow-lg disabled:opacity-50"
            >
              {saving && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
              {saving ? "Registrando venta…" : `Confirmar venta · ${formatMoney(preview.total)}`}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
