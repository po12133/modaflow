import type { Metadata } from "next";
import { FilterBar, FilterField, filterField } from "@/components/admin/filter-bar";
import { TenantsTable } from "@/components/admin/tenants-table";
import { Pagination } from "@/components/pagination";
import { STATUS_LABELS } from "@/lib/format";
import { searchParam as one } from "@/lib/search-params";
import { getAdminPlans, getAdminTenants } from "@/services/admin";

export const metadata: Metadata = { title: "Negocios" };

export const instant = false;

const KEYS = ["search", "plan", "status", "createdFrom", "createdTo", "expiresFrom", "expiresTo"] as const;

export default async function TenantsPage({ searchParams }: PageProps<"/admin/negocios">) {
  const sp = await searchParams;
  const f = Object.fromEntries(KEYS.map((k) => [k, one(sp[k])])) as Record<(typeof KEYS)[number], string | undefined>;
  const [data, plans] = await Promise.all([getAdminTenants({ ...f, page: Number(one(sp.page)) || 1 }), getAdminPlans()]);
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Negocios</h1>
      <FilterBar>
        <FilterField label="Buscar" wide>
          <input name="search" defaultValue={f.search} placeholder="Nombre, correo, WhatsApp o ID" className={filterField} />
        </FilterField>
        <FilterField label="Plan">
          <select name="plan" defaultValue={f.plan ?? ""} className={filterField}>
            <option value="">Todos</option>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Estado">
          <select name="status" defaultValue={f.status ?? ""} className={filterField}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Registro desde"><input type="date" name="createdFrom" defaultValue={f.createdFrom} className={filterField} /></FilterField>
        <FilterField label="Registro hasta"><input type="date" name="createdTo" defaultValue={f.createdTo} className={filterField} /></FilterField>
        <FilterField label="Vence desde"><input type="date" name="expiresFrom" defaultValue={f.expiresFrom} className={filterField} /></FilterField>
        <FilterField label="Vence hasta"><input type="date" name="expiresTo" defaultValue={f.expiresTo} className={filterField} /></FilterField>
      </FilterBar>
      <TenantsTable items={data.items} />
      <Pagination basePath="/admin/negocios" params={f} page={data.page} totalPages={data.totalPages} total={data.total} noun="negocios" />
    </div>
  );
}
