"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS } from "@/config/reports";
import { formatMoney } from "@/lib/format";
import { DataTable, EmptyChart, TooltipBox } from "./chart-parts";

export interface RankItem {
  name: string;
  value: number;
  detail?: string;
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function RankChart({ items, format, label }: { items: RankItem[]; format: "money" | "units"; label: string }) {
  if (items.length === 0) return <EmptyChart text="Sin ventas en este periodo." />;
  const fmt = (v: number) => (format === "money" ? formatMoney(v) : `${v.toLocaleString("es-BO")} u.`);
  const data = items.map((i) => ({ ...i, short: truncate(i.name, 16) }));
  return (
    <figure className="grid gap-2">
      <div className="w-full" style={{ height: Math.max(96, data.length * 36 + 8) }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }} barCategoryGap={8}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis type="category" dataKey="short" width={112} tick={{ fontSize: 12, fill: CHART_COLORS.label }} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(108,76,245,0.08)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]!.payload as (typeof data)[number];
                return <TooltipBox title={d.name} rows={[{ label: format === "money" ? "Ingresos" : "Prendas", value: fmt(d.value) }, ...(d.detail ? [{ label: "Detalle", value: d.detail }] : [])]} />;
              }}
            />
            <Bar dataKey="value" fill={CHART_COLORS.current} radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
              <LabelList dataKey="value" position="right" formatter={(v: unknown) => fmt(Number(v)).replace(" ", " ")} style={{ fontSize: 11, fill: CHART_COLORS.ink, fontWeight: 700 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable headers={["Nombre", format === "money" ? "Ingresos" : "Prendas"]} rows={items.map((i) => [i.name, fmt(i.value)])} />
    </figure>
  );
}
