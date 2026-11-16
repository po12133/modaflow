import type { Metadata } from "next";
import Link from "next/link";
import { Pagination } from "@modaflow/ui/components/pagination";
import { PeriodPicker } from "@modaflow/ui/components/period-picker";
import { searchParam as one } from "@modaflow/ui/lib/search-params";
import { AccountsTable } from "@/components/consumption/accounts-table";
import { ConsumptionKpis } from "@/components/consumption/consumption-kpis";
import { ModelTable } from "@/components/consumption/model-table";
import { ADMIN_PERIODS } from "@/config/admin";
import { periodQuery } from "@/lib/period-query";
import { getConsumption, getConsumptionAccounts } from "@/services/consumption";

export const metadata: Metadata = { title: "Consumo" };

export const instant = false;

export default async function ConsumptionPage({ searchParams }: PageProps<"/consumo">) {
  const sp = await searchParams;
  const period = periodQuery(sp);
  const [summary, accounts] = await Promise.all([getConsumption(period), getConsumptionAccounts({ ...period, page: Number(one(sp.page)) || 1 })]);
  const query = new URLSearchParams(period).toString();
  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Consumo</h1>
          <p className="text-sm font-semibold text-ink-2">{summary.period.label} · {summary.period.from} a {summary.period.to}</p>
        </div>
        <Link href={`/consumo/ia?${query}`} className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-bold text-white">Registro de IA</Link>
      </header>
      <PeriodPicker period={summary.period.key} from={summary.period.from} to={summary.period.to} options={ADMIN_PERIODS} />
      <ConsumptionKpis s={summary} />
      <ModelTable s={summary} />
      <section className="grid gap-3">
        <h2 className="text-lg font-extrabold">Por cuenta</h2>
        <AccountsTable items={accounts.items} query={query} />
        <Pagination basePath="/consumo" params={period} page={accounts.page} totalPages={accounts.totalPages} total={accounts.total} noun="cuentas" />
      </section>
      <p className="text-xs text-muted-foreground">
        El costo es una estimación con el precio de lista de Claude (USD por millón de tokens); la factura real está en console.anthropic.com. Los análisis fallidos no se cobran a la tienda.
        Los productos eliminados por las tiendas se conservan como registro, igual que las fotos analizadas con IA.
      </p>
    </div>
  );
}
