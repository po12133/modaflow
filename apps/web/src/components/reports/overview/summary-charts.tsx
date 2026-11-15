import Link from "next/link";
import { PAYMENT_LABELS, plural } from "@modaflow/ui/lib/format";
import type { PaymentRow, ProductsReport, SalesChart } from "@/types/reports";
import { RankChart } from "@modaflow/ui/components/charts/rank-chart";
import { TopProductsChart } from "../charts/top-products-chart";
import { SalesTrendChart } from "../charts/trend-chart";
import { Panel } from "@modaflow/ui/components/panel";

interface SummaryChartsProps {
  chart: SalesChart;
  methods: PaymentRow[];
  products: ProductsReport;
  previousLabel: string;
  productsHref: string;
}

export function SummaryCharts({ chart, methods, products, previousLabel, productsHref }: SummaryChartsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Evolución de ventas" className="lg:col-span-2">
        <SalesTrendChart points={chart.points} previousLabel={`Periodo anterior (${previousLabel})`} />
      </Panel>
      <Panel
        title="Productos más vendidos"
        action={
          <Link href={productsHref} className="text-sm font-bold text-primary">
            Ver todos
          </Link>
        }
      >
        <TopProductsChart items={products.items} />
      </Panel>
      <Panel title="Ventas por categoría">
        <RankChart
          items={products.categories.map((c) => ({ name: c.name, value: Number(c.revenue), detail: `${c.units} u.` }))}
          format="money"
          label="Ingresos por categoría"
        />
      </Panel>
      <Panel title="Métodos de pago" className="lg:col-span-2">
        <RankChart
          items={methods.map((m) => ({ name: PAYMENT_LABELS[m.method], value: Number(m.total), detail: plural(m.sales, "venta") }))}
          format="money"
          label="Total por método de pago"
        />
      </Panel>
    </div>
  );
}
