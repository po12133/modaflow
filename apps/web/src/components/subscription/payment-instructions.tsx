import { formatMoney } from "@/lib/format";
import type { PaymentInfo, PaymentRequest } from "@/types/billing";

export function PaymentInstructions({ info, request }: { info: PaymentInfo; request: PaymentRequest }) {
  const rows: [string, string | null][] = [
    ["Titular", info.accountHolder],
    ["Banco", info.bankName],
    ["Cuenta", request.method === "TRANSFER" ? info.accountNumber : null],
    ["Tipo de cuenta", request.method === "TRANSFER" ? info.accountType : null],
  ];
  return (
    <section aria-label="Instrucciones de pago" className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-[auto_1fr]">
      {request.method === "QR" && info.qrImageUrl && (
        <figure className="grid justify-items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed S3 URL */}
          <img src={info.qrImageUrl} alt="QR bancario de ModaFlow para pagar la suscripción" className="size-56 rounded-xl border bg-white object-contain p-2" />
          <figcaption className="text-xs text-muted-foreground">QR bancario de ModaFlow (pago de suscripción)</figcaption>
        </figure>
      )}
      <div className="grid content-start gap-3">
        <p className="text-sm text-muted-foreground">Importe a pagar</p>
        <p className="text-3xl font-extrabold text-primary">{request.amountExpected ? formatMoney(request.amountExpected) : "—"}</p>
        <p className="text-sm">
          Plan <b>{request.toPlan.name}</b> · 1 mes
        </p>
        <dl className="grid gap-1 text-sm">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-muted-foreground">{k}:</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
        </dl>
        {info.instructions && <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm whitespace-pre-line">{info.instructions}</p>}
      </div>
    </section>
  );
}
