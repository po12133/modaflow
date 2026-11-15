"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RankChart } from "./rank-chart";

export function TopProductsChart({ items }: { items: { name: string; units: number; revenue: string }[] }) {
  const [by, setBy] = useState<"units" | "revenue">("units");
  const sorted = [...items]
    .map((i) => ({ name: i.name, value: by === "units" ? i.units : Number(i.revenue), detail: by === "units" ? formatMoney(i.revenue) : `${i.units} u.` }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  return (
    <div className="grid gap-3">
      <div className="flex gap-1 justify-self-start rounded-xl bg-muted p-1" role="radiogroup" aria-label="Ordenar ranking por">
        {(
          [
            ["units", "Por prendas"],
            ["revenue", "Por ingresos"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={by === v}
            onClick={() => setBy(v)}
            className={cn("h-8 rounded-lg px-3 text-xs font-bold", by === v ? "bg-white text-violet-strong shadow-sm" : "text-ink-2")}
          >
            {l}
          </button>
        ))}
      </div>
      <RankChart items={sorted} format={by === "units" ? "units" : "money"} label="Ranking de productos más vendidos" />
    </div>
  );
}
