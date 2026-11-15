import { Lock } from "lucide-react";

export function NoReportAccess() {
  return (
    <section className="grid place-items-center rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
        <Lock className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-lg font-extrabold">Reportes</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">Solo el propietario o un administrador de la tienda pueden ver los reportes.</p>
    </section>
  );
}
