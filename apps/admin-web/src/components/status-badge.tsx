import { SUBSCRIPTION_STATUS_TONES } from "@/config/admin";
import { STATUS_LABELS } from "@modaflow/ui/lib/format";
import type { SubscriptionStatus } from "@modaflow/ui/types/common";
import { cn } from "@modaflow/ui/lib/utils";

export function SubscriptionBadge({ status }: { status: SubscriptionStatus | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">Sin suscripción</span>;
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap", SUBSCRIPTION_STATUS_TONES[status])}>{STATUS_LABELS[status]}</span>;
}
