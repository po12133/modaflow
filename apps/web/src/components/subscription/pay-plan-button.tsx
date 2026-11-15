"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPaymentRequestAction } from "@/actions/subscription";
import { METHOD_LABELS } from "@modaflow/ui/config/billing";
import type { PlatformMethod } from "@modaflow/ui/types/billing";

export function PayPlanButton({ planCode, label, methods }: { planCode: string; label: string; methods: PlatformMethod[] }) {
  const router = useRouter();
  const [method, setMethod] = useState<PlatformMethod | undefined>(methods[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (methods.length === 0) return <p className="text-xs text-muted-foreground">Los pagos todavía no están habilitados.</p>;

  function pay() {
    if (!method) return;
    setError(null);
    start(async () => {
      const res = await createPaymentRequestAction(planCode, method);
      if (res.ok) router.push(`/dashboard/suscripcion/pago/${res.data.id}`);
      else setError(res.message);
    });
  }

  return (
    <div className="grid gap-2">
      {methods.length > 1 && (
        <select aria-label="Método de pago" value={method} onChange={(e) => setMethod(e.target.value as PlatformMethod)} className="h-10 rounded-xl border bg-card px-2 text-sm">
          {methods.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      )}
      <button type="button" onClick={pay} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-60">
        {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {label}
      </button>
      {error && <p role="alert" className="text-xs font-semibold text-destructive">{error}</p>}
    </div>
  );
}
