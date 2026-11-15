import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, FilterField, filterField } from "@/components/admin/filter-bar";
import { Pagination } from "@/components/pagination";
import { PaymentStatusBadge } from "@/components/subscription/payment-history";
import { METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/config/billing";
import { formatDateTime, formatMoney } from "@/lib/format";
import { searchParam as one } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { getAdminPayments, getAdminPlans } from "@/services/admin";

export const metadata: Metadata = { title: "Pagos" };

export const instant = false;

export default async function PaymentsPage({ searchParams }: PageProps<"/admin/pagos">) {
  const sp = await searchParams;
  const f = { status: one(sp.status), planId: one(sp.planId), from: one(sp.from), to: one(sp.to) };
  const [data, plans] = await Promise.all([getAdminPayments({ ...f, page: Number(one(sp.page)) || 1 }), getAdminPlans()]);
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Pagos {data.pendingReview > 0 && <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 align-middle text-sm text-white">{data.pendingReview} por revisar</span>}</h1>
      <FilterBar>
        <FilterField label="Estado">
          <select name="status" defaultValue={f.status ?? ""} className={filterField}>
            <option value="">Todos</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </FilterField>
        <FilterField label="Plan">
          <select name="planId" defaultValue={f.planId ?? ""} className={filterField}>
            <option value="">Todos</option>
            {plans.filter((p) => !p.isTrial).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FilterField>
        <FilterField label="Desde"><input type="date" name="from" defaultValue={f.from} className={filterField} /></FilterField>
        <FilterField label="Hasta"><input type="date" name="to" defaultValue={f.to} className={filterField} /></FilterField>
      </FilterBar>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
        {data.items.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No hay pagos con estos filtros.</li>}
        {data.items.map((p) => (
          <li key={p.id} className={cn(p.status === "PENDING" && p.submittedAt && "bg-[#fff7e6]")}>
            <Link href={`/admin/pagos/${p.id}`} className="flex items-center gap-3 p-3.5">
              <span className="min-w-0 flex-1">
                <b className="block truncate">{p.tenant.name}</b>
                <span className="block text-xs text-muted-foreground">
                  {p.toPlan.name} · {p.method ? METHOD_LABELS[p.method] : ""} · {formatDateTime(p.submittedAt ?? p.createdAt)}
                  {p.status === "PENDING" ? (p.hasReceipt && p.submittedAt ? " · comprobante enviado" : " · sin comprobante") : ""}
                </span>
              </span>
              <b className="whitespace-nowrap">{p.amountExpected ? formatMoney(p.amountExpected) : ""}</b>
              <PaymentStatusBadge status={p.status} />
            </Link>
          </li>
        ))}
      </ul>
      <Pagination basePath="/admin/pagos" params={f} page={data.page} totalPages={data.totalPages} total={data.total} noun="pagos" />
    </div>
  );
}
