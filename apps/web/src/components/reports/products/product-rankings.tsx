import { formatMoney, variantLabel } from "@modaflow/ui/lib/format";
import type { ProductsReport } from "@/types/reports";
import { RankChart } from "@modaflow/ui/components/charts/rank-chart";
import { Panel } from "@modaflow/ui/components/panel";

export function ProductRankings({ report, sort, showRanking }: { report: ProductsReport; sort: string; showRanking: boolean }) {
  const byRevenue = sort.startsWith("revenue");
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {showRanking && (
          <Panel title={sort === "units_asc" ? "Menos vendidos (top 10)" : "Ranking (top 10)"}>
            <RankChart
              items={report.items
                .slice(0, 10)
                .map((i) => (byRevenue ? { name: i.name, value: Number(i.revenue), detail: `${i.units} u.` } : { name: i.name, value: i.units, detail: formatMoney(i.revenue) }))}
              format={byRevenue ? "money" : "units"}
              label="Ranking de productos"
            />
          </Panel>
        )}
        <Panel title="Categorías más vendidas">
          <RankChart items={report.categories.map((c) => ({ name: c.name, value: Number(c.revenue), detail: `${c.units} u.` }))} format="money" label="Ingresos por categoría" />
        </Panel>
      </div>
      <Panel title="Variantes más vendidas">
        {report.variants.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ventas en este periodo.</p>
        ) : (
          <ol className="divide-y text-sm">
            {report.variants.map((v, i) => (
              <li key={v.variantId} className="flex items-center gap-3 py-2">
                <span className="w-5 text-right text-xs font-bold text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{v.productName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {variantLabel(v)} · <span className="font-mono">{v.sku}</span>
                  </span>
                </span>
                <span className="text-right text-xs whitespace-nowrap">
                  <b className="block text-sm">{v.units} u.</b>
                  {formatMoney(v.revenue)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
