import type { Metadata } from "next";
import { FilterBar, FilterField, filterField } from "@/components/admin/filter-bar";
import { Pagination } from "@/components/pagination";
import { formatDateTime } from "@/lib/format";
import { searchParam as one } from "@/lib/search-params";
import { getAdminAudit } from "@/services/admin";

export const metadata: Metadata = { title: "Auditoría" };

export const instant = false;

const diff = (v: Record<string, unknown> | null) => (v ? Object.entries(v).map(([k, x]) => `${k}: ${typeof x === "object" ? JSON.stringify(x) : String(x)}`).join(" · ") : "");

export default async function AuditPage({ searchParams }: PageProps<"/admin/auditoria">) {
  const sp = await searchParams;
  const f = { entityType: one(sp.entityType), action: one(sp.action), entityId: one(sp.entityId) };
  const data = await getAdminAudit({ ...f, page: Number(one(sp.page)) || 1 });
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Auditoría</h1>
      <p className="text-sm text-muted-foreground">Registro de solo lectura: la base de datos impide modificar o borrar entradas.</p>
      <FilterBar>
        <FilterField label="Entidad">
          <select name="entityType" defaultValue={f.entityType ?? ""} className={filterField}>
            <option value="">Todas</option>
            {["PaymentRequest", "Subscription", "Tenant", "User", "Plan", "PlatformSettings"].map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </FilterField>
        <FilterField label="Acción"><input name="action" defaultValue={f.action} placeholder="PAYMENT_APPROVED" className={filterField} /></FilterField>
        <FilterField label="ID de entidad"><input name="entityId" defaultValue={f.entityId} className={filterField} /></FilterField>
      </FilterBar>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card text-sm shadow-sm">
        {data.items.map((a) => (
          <li key={a.id} className="grid gap-0.5 p-3.5">
            <span className="flex flex-wrap items-center gap-2">
              <b className="font-mono text-xs">{a.action}</b>
              <span className="text-xs text-muted-foreground">{a.entityType} {a.entityId.slice(0, 8)} · {formatDateTime(a.createdAt)} · {a.actor.name}</span>
              {a.result === "FAILURE" && <span className="text-xs font-bold text-destructive">Fallida</span>}
            </span>
            {a.reason && <span className="text-ink-2">Motivo: {a.reason}</span>}
            {(a.before || a.after) && <span className="truncate text-xs text-muted-foreground" title={`${diff(a.before)} → ${diff(a.after)}`}>{diff(a.before)} → {diff(a.after)}</span>}
          </li>
        ))}
      </ul>
      <Pagination basePath="/admin/auditoria" params={f} page={data.page} totalPages={data.totalPages} total={data.total} noun="registros" />
    </div>
  );
}
