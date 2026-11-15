import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, FilterField, filterField } from "@/components/admin/filter-bar";
import { SubscriptionBadge } from "@/components/admin/status-badge";
import { Pagination } from "@/components/pagination";
import { formatDate, formatMoney, STATUS_LABELS } from "@/lib/format";
import { searchParam as one } from "@/lib/search-params";
import { getAdminPlans, getAdminSubscriptions } from "@/services/admin";

export const metadata: Metadata = { title: "Suscripciones" };

export const instant = false;

export default async function SubscriptionsPage({ searchParams }: PageProps<"/admin/suscripciones">) {
  const sp = await searchParams;
  const f = { status: one(sp.status), plan: one(sp.plan), search: one(sp.search) };
  const [data, plans] = await Promise.all([getAdminSubscriptions({ ...f, page: Number(one(sp.page)) || 1 }), getAdminPlans()]);
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Suscripciones</h1>
      <FilterBar>
        <FilterField label="Negocio" wide><input name="search" defaultValue={f.search} className={filterField} /></FilterField>
        <FilterField label="Estado">
          <select name="status" defaultValue={f.status ?? ""} className={filterField}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </FilterField>
        <FilterField label="Plan">
          <select name="plan" defaultValue={f.plan ?? ""} className={filterField}>
            <option value="">Todos</option>
            {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </FilterField>
      </FilterBar>
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>{["Negocio", "Plan", "Estado", "Inicio", "Vence", "Precio del periodo", "Último pago", "Próxima renovación"].map((h) => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {data.items.map((s) => (
              <tr key={s.id} className="hover:bg-muted/40">
                <td className="px-3 py-2.5 font-bold"><Link href={`/admin/negocios/${s.tenant.id}`} className="text-primary hover:underline">{s.tenant.name}</Link></td>
                <td className="px-3 py-2.5">{s.plan.name}</td>
                <td className="px-3 py-2.5"><SubscriptionBadge status={s.effectiveStatus} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(s.startedAt)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(s.currentPeriodEnd)}</td>
                <td className="px-3 py-2.5">{s.periodPrice ? formatMoney(s.periodPrice) : "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{s.lastPayment ? `${formatMoney(s.lastPayment.amount)} · ${formatDate(s.lastPayment.date)}` : "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{s.nextRenewal ? formatDate(s.nextRenewal) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination basePath="/admin/suscripciones" params={f} page={data.page} totalPages={data.totalPages} total={data.total} noun="suscripciones" />
    </div>
  );
}
