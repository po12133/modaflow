import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PaymentReview } from "@/components/payment-review";
import { PaymentStatusBadge } from "@modaflow/ui/components/payment-status-badge";
import { ApiError } from "@/lib/api";
import { getMe } from "@/lib/dal";
import { getAdminPayment } from "@/services/admin";

export const metadata: Metadata = { title: "Revisión de pago" };

export const instant = false;

export default async function PaymentReviewPage({ params }: PageProps<"/pagos/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [payment, me] = await Promise.all([
    getAdminPayment(id).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 404) notFound();
      throw e;
    }),
    getMe(),
  ]);
  return (
    <div className="grid gap-4">
      <Link href="/pagos" className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold text-primary">
        <ChevronLeft className="size-4" aria-hidden="true" /> Pagos
      </Link>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">
          <Link href={`/negocios/${payment.tenant.id}`} className="hover:text-primary">{payment.tenant.name}</Link>
        </h1>
        <PaymentStatusBadge status={payment.status} />
      </header>
      <PaymentReview payment={payment} canReview={me?.role === "SUPERADMIN"} />
    </div>
  );
}
