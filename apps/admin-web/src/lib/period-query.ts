import { searchParam as one } from "@modaflow/ui/lib/search-params";
import { ADMIN_PERIODS } from "@/config/admin";

type SearchParams = Record<string, string | string[] | undefined>;

export function periodQuery(sp: SearchParams, fallback = "this_month"): Record<string, string> {
  const period = ADMIN_PERIODS.some(([k]) => k === one(sp.period)) ? one(sp.period)! : fallback;
  const from = one(sp.from);
  const to = one(sp.to);
  if (period === "custom") return from && to ? { period, from, to } : { period: fallback };
  return { period };
}
