import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { FilterBar, FilterField, filterField } from "@/components/filter-bar";
import { AiLogList } from "@/components/consumption/ai-log-list";
import { Pagination } from "@modaflow/ui/components/pagination";
import { PeriodPicker } from "@modaflow/ui/components/period-picker";
import { searchParam as one } from "@modaflow/ui/lib/search-params";
import { ADMIN_PERIODS } from "@/config/admin";
import { AI_STATUS } from "@/lib/consumption-format";
import { periodQuery } from "@/lib/period-query";
import { getAiLog } from "@/services/consumption";

export const metadata: Metadata = { title: "Registro de IA" };

export const instant = false;

export default async function AiLogPage({ searchParams }: PageProps<"/consumo/ia">) {
  const sp = await searchParams;
  const tenantId = /^[0-9a-f-]{36}$/i.test(one(sp.tenantId) ?? "") ? one(sp.tenantId) : undefined;
  const status = one(sp.status) && AI_STATUS[one(sp.status)!] ? one(sp.status) : undefined;
  const f = { ...periodQuery(sp), tenantId, status };
  const data = await getAiLog({ ...f, page: Number(one(sp.page)) || 1 });
  return (
    <div className="grid gap-4">
      <Link href="/consumo" className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold text-primary">
        <ChevronLeft className="size-4" aria-hidden="true" /> Consumo
      </Link>
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Registro de IA</h1>
        <p className="text-sm text-muted-foreground">
          Cada análisis de fotos con Claude: cuenta, usuario, modelo, tokens y costo estimado. {data.period.label} · {data.total} análisis.
          {tenantId && data.items[0] ? ` Solo ${data.items[0].tenant.name}.` : ""}
        </p>
      </header>
      <PeriodPicker period={data.period.key} from={data.period.from} to={data.period.to} options={ADMIN_PERIODS} />
      <FilterBar>
        {tenantId && <input type="hidden" name="tenantId" value={tenantId} />}
        {Object.entries(periodQuery(sp)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <FilterField label="Resultado">
          <select name="status" defaultValue={status ?? ""} className={filterField}>
            <option value="">Todos</option>
            {Object.entries(AI_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </FilterField>
      </FilterBar>
      <AiLogList items={data.items} />
      <Pagination basePath="/consumo/ia" params={f} page={data.page} totalPages={data.totalPages} total={data.total} noun="análisis" />
    </div>
  );
}
