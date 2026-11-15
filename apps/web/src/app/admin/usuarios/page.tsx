import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar, FilterField, filterField } from "@/components/admin/filter-bar";
import { Pagination } from "@/components/pagination";
import { formatDate } from "@/lib/format";
import { searchParam as one } from "@/lib/search-params";
import { getAdminUsers } from "@/services/admin";

export const metadata: Metadata = { title: "Usuarios" };

export const instant = false;

export default async function UsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  const sp = await searchParams;
  const f = { search: one(sp.search), status: one(sp.status) };
  const data = await getAdminUsers({ ...f, page: Number(one(sp.page)) || 1 });
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Usuarios</h1>
      <FilterBar>
        <FilterField label="Buscar" wide>
          <input name="search" defaultValue={f.search} placeholder="Nombre, correo o ID" className={filterField} />
        </FilterField>
        <FilterField label="Estado">
          <select name="status" defaultValue={f.status ?? ""} className={filterField}>
            <option value="">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="SUSPENDED">Suspendidos</option>
          </select>
        </FilterField>
      </FilterBar>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
        {data.items.map((u) => (
          <li key={u.id}>
            <Link href={`/admin/usuarios/${u.id}`} className="grid gap-0.5 p-3.5 hover:bg-muted/40 sm:grid-cols-[1fr_auto] sm:items-center">
              <span className="min-w-0">
                <b className="block truncate">{u.name}{u.globalRole ? ` · ${u.globalRole === "SUPERADMIN" ? "Superadmin" : "Soporte"}` : ""}</b>
                <span className="block truncate text-xs text-muted-foreground">{u.email} · registro {formatDate(u.createdAt)}</span>
                <span className="block truncate text-xs text-ink-2">{u.memberships.map((m) => `${m.tenant.name} (${m.role})`).join(", ") || "Sin negocio"}</span>
              </span>
              <span className={u.status === "SUSPENDED" ? "text-xs font-bold text-destructive" : "text-xs font-bold text-[#0b7a66]"}>{u.status === "SUSPENDED" ? "Suspendido" : "Activo"}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination basePath="/admin/usuarios" params={f} page={data.page} totalPages={data.totalPages} total={data.total} noun="usuarios" />
    </div>
  );
}
