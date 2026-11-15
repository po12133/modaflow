"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

export function useUrlUpdate() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = (patch: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(search.toString());
    qs.delete("page");
    for (const [k, v] of Object.entries(patch)) {
      if (v) qs.set(k, v);
      else qs.delete(k);
    }
    const s = qs.toString();
    startTransition(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };
  return { update, pending, search };
}

export const chip = (on: boolean) =>
  cn("h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap", on ? "border-foreground bg-foreground text-white" : "bg-card text-ink-2");
