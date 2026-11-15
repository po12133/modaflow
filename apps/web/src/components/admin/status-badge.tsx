import { SUBSCRIPTION_STATUS_TONES } from "@/config/admin";
import { STATUS_LABELS } from "@/lib/format";
import type { SubscriptionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SubscriptionBadge({ status }: { status: SubscriptionStatus | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">Sin suscripción</span>;
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap", SUBSCRIPTION_STATUS_TONES[status])}>{STATUS_LABELS[status]}</span>;
}
