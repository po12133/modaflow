import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PaymentStatusBadge } from "@modaflow/ui/components/payment-status-badge";
import { PaymentInstructions } from "@/components/subscription/payment-instructions";
import { ReceiptUploader } from "@/components/subscription/receipt-uploader";
import { ApiError } from "@/lib/api";
import { formatDate, formatDateTime } from "@modaflow/ui/lib/format";
import { getPaymentInfo, getPaymentRequest } from "@/services/billing";

export const metadata: Metadata = { title: "Pago de suscripción" };

export const instant = false;

export default async function PaymentPage({ params }: PageProps<"/dashboard/suscripcion/pago/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [request, info] = await Promise.all([
    getPaymentRequest(id).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 404) notFound();
      throw e;
    }),
    getPaymentInfo(),
  ]);
  const editable = request.status === "PENDING" && !request.submittedAt;

  return (
    <div className="grid max-w-3xl gap-4">
      <Link href="/dashboard/suscripcion" className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold text-primary">
        <ChevronLeft className="size-4" aria-hidden="true" /> Suscripción
      </Link>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Pago del plan {request.toPlan.name}</h1>
        <PaymentStatusBadge status={request.status} />
      </header>
      {request.status === "PENDING" && request.submittedAt && (
        <p role="status" className="rounded-xl bg-[#e7efff] px-3 py-2 text-sm text-[#2357b8]">
          Enviaste el comprobante el {formatDateTime(request.submittedAt)}. Lo estamos revisando; te avisaremos en Notificaciones.
        </p>
      )}
      {request.status === "APPROVED" && request.period && (
        <p role="status" className="rounded-xl bg-mint/10 px-3 py-2 text-sm font-semibold text-[#0b7a66]">
          Pago aprobado. Tu plan {request.toPlan.name} está activo hasta el {formatDate(request.period.periodEnd)}.
        </p>
      )}
      {request.status === "REJECTED" && <p className="rounded-xl bg-destructive/5 px-3 py-2 text-sm text-destructive">Pago no aprobado: {request.reviewNote}</p>}
      {request.status === "PENDING" && <PaymentInstructions info={info} request={request} />}
      {editable && <ReceiptUploader request={request} />}
    </div>
  );
}
