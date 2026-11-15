"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS } from "@/config/reports";
import { formatMoney } from "@/lib/format";
import { shortMoney } from "@/lib/reports";

export function RevenueChart({ points, metric }: { points: { label: string; revenue: string; newTenants: number }[]; metric: "revenue" | "newTenants" }) {
  const data = points.map((p) => ({ label: p.label, value: metric === "revenue" ? Number(p.revenue) : p.newTenants }));
  if (!data.some((d) => d.value > 0)) return <p className="grid min-h-28 place-items-center rounded-xl bg-muted/50 text-sm text-muted-foreground">Sin datos en este periodo.</p>;
  const fmt = (v: number) => (metric === "revenue" ? formatMoney(v) : `${v} negocios`);
  return (
    <figure className="grid gap-2">
      <div className="h-56 w-full" role="img" aria-label={metric === "revenue" ? "Ingresos cobrados por periodo" : "Nuevos negocios por periodo"}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} minTickGap={12} />
            <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.axis }} tickLine={false} axisLine={false} width={58} allowDecimals={false} tickFormatter={(v: number) => (metric === "revenue" ? shortMoney(v) : String(v))} />
            <Tooltip
              cursor={{ fill: "rgba(108,76,245,0.08)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-xl border bg-white px-3 py-2 text-xs shadow-lg">
                    <b>{String(label)}</b>
                    <p>{fmt(Number(payload[0]!.value))}</p>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="value" fill={CHART_COLORS.current} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer font-semibold text-primary">Ver como tabla</summary>
        <ul className="mt-2 grid gap-1">
          {data.map((d) => (
            <li key={d.label} className="flex justify-between">
              <span>{d.label}</span>
              <b>{fmt(d.value)}</b>
            </li>
          ))}
        </ul>
      </details>
    </figure>
  );
}
