import { CheckCircle2, XCircle } from "lucide-react";
import type { BackupsView } from "@/types/backups";

const ITEMS: [keyof BackupsView["ready"], string, string][] = [
  ["storage", "Almacenamiento S3", "Configúralo en Configuración → Almacenamiento."],
  ["encryption", "Clave de cifrado", "Define BACKUP_ENCRYPTION_KEY en el servidor (openssl rand -hex 32)."],
  ["database", "Acceso de lectura a la base de datos", "Define BACKUP_DB_PASSWORD en el servidor y redespliega."],
];

export function BackupReadiness({ ready }: { ready: BackupsView["ready"] }) {
  if (ready.storage && ready.encryption && ready.database) return null;
  return (
    <section aria-label="Configuración pendiente" className="grid gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm">
      <b>Falta configuración para crear backups</b>
      <ul className="grid gap-1.5">
        {ITEMS.map(([key, label, hint]) => (
          <li key={key} className="flex items-start gap-2">
            {ready[key] ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#0b7a66]" aria-hidden="true" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />}
            <span>
              <b>{label}</b>
              {!ready[key] && <span className="text-muted-foreground"> · {hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
