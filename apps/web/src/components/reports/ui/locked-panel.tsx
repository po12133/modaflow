import Link from "next/link";
import { Lock } from "lucide-react";
import { ADVANCED_FEATURES, REQUIRED_PLAN } from "@/config/reports";

export function LockedPanel({ title, features = ADVANCED_FEATURES, operational = true }: { title: string; features?: string[]; operational?: boolean }) {
  return (
    <section aria-label={title} className="grid gap-3 rounded-2xl border border-dashed bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <Lock className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-extrabold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {operational ? `Disponible desde el plan ${REQUIRED_PLAN}.` : "Tu suscripción no está activa: renuévala para usar los reportes avanzados."}
          </p>
        </div>
      </div>
      <ul className="grid gap-1 text-sm text-ink-2 sm:grid-cols-2">
        {features.map((f) => (
          <li key={f}>• {f}</li>
        ))}
      </ul>
      <Link href="/dashboard/suscripcion" className="inline-flex h-11 items-center justify-center justify-self-start rounded-xl bg-primary px-4 text-sm font-bold text-white">
        Ver planes
      </Link>
    </section>
  );
}
