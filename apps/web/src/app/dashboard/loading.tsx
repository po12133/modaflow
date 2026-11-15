/** Placeholder for a panel page while its data streams in (keeps the shell interactive). */
export default function DashboardLoading() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
