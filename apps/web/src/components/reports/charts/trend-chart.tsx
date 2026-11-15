"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS } from "@/config/reports";
import { formatMoney } from "@/lib/format";
import { shortMoney } from "@/lib/reports";
import type { ChartPoint } from "@/types/reports";
import { DataTable, EmptyChart, TooltipBox } from "./chart-parts";

const { current: CURRENT, previous: PREVIOUS, grid: GRID, axis: AXIS } = CHART_COLORS;

export function SalesTrendChart({ points, previousLabel }: { points: ChartPoint[]; previousLabel: string }) {
  const data = points.map((p) => ({
    label: p.label,
    total: p.total === null ? null : Number(p.total),
    previous: p.previousTotal === null ? null : Number(p.previousTotal),
    sales: p.sales,
  }));
  const hasData = data.some((d) => (d.total ?? 0) > 0 || (d.previous ?? 0) > 0);
  if (!hasData) return <EmptyChart text="Sin ventas en este periodo ni en el anterior." />;
  return (
    <figure className="grid gap-2">
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink-2">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2.5 rounded-sm" style={{ background: CURRENT }} />
          Periodo actual
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: PREVIOUS }} />
          {previousLabel}
        </span>
      </figcaption>
      <div className="h-56 w-full" role="img" aria-label="Gráfico de evolución de ventas">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={12} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={58} tickFormatter={(v: number) => shortMoney(v)} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "rgba(108,76,245,0.08)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]!.payload as (typeof data)[number];
                return (
                  <TooltipBox
                    title={String(label)}
                    rows={[
                      { label: "Actual", value: d.total === null ? "—" : formatMoney(d.total), color: CURRENT },
                      ...(d.sales !== null ? [{ label: "Ventas", value: String(d.sales) }] : []),
                      { label: "Anterior", value: d.previous === null ? "—" : formatMoney(d.previous), color: PREVIOUS, dashed: true },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="total" fill={CURRENT} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Line dataKey="previous" stroke={PREVIOUS} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        headers={["Periodo", "Actual", "Anterior"]}
        rows={data.map((d) => [d.label, d.total === null ? "—" : formatMoney(d.total), d.previous === null ? "—" : formatMoney(d.previous)])}
      />
    </figure>
  );
}
