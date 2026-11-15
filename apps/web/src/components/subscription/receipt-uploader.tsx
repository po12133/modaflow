"use client";

import { LoaderCircle, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { cancelPaymentAction, submitPaymentAction } from "@/actions/subscription";
import type { PaymentRequest } from "@modaflow/ui/types/billing";

export function ReceiptUploader({ request }: { request: PaymentRequest }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function upload(file: File) {
    setError(null);
    start(async () => {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/billing/receipt/${request.id}`, { method: "POST", body });
      if (!res.ok) setError(((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? "No se pudo subir el comprobante.");
      else router.refresh();
    });
  }

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.message ?? "No se pudo completar la acción.");
    });

  return (
    <section aria-label="Comprobante" className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="font-extrabold">Comprobante de pago</h2>
      {request.receiptUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
        <img src={request.receiptUrl} alt="Comprobante subido" className="max-h-80 w-full rounded-xl border object-contain" />
      ) : (
        <p className="text-sm text-muted-foreground">Después de pagar, sube una foto o captura del comprobante.</p>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button type="button" onClick={() => input.current?.click()} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-card text-sm font-bold">
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
        {request.hasReceipt ? "Cambiar comprobante" : "Subir comprobante"}
      </button>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={!request.hasReceipt} className="mt-0.5 size-5 accent-[#6c4cf5]" />
        Confirmo que realicé el pago y que el comprobante corresponde a esta solicitud.
      </label>
      <button type="button" disabled={!request.hasReceipt || !confirmed || pending} onClick={() => run(() => submitPaymentAction(request.id))} className="h-12 rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-50">
        Enviar comprobante para revisión
      </button>
      <button type="button" disabled={pending} onClick={() => run(() => cancelPaymentAction(request.id))} className="text-sm font-semibold text-muted-foreground underline">
        Cancelar esta solicitud
      </button>
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">El comprobante no activa el plan automáticamente: el equipo de ModaFlow lo revisa y te avisa.</p>
    </section>
  );
}
