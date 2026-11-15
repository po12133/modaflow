import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONES } from "../config/billing";
import { cn } from "../lib/utils";
import type { PaymentRequest } from "../types/billing";

export function PaymentStatusBadge({ status }: { status: PaymentRequest["status"] }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap", PAYMENT_STATUS_TONES[status])}>{PAYMENT_STATUS_LABELS[status]}</span>;
}
