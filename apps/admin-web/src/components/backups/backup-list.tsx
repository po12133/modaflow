import { formatDateTime } from "@modaflow/ui/lib/format";
import { cn } from "@modaflow/ui/lib/utils";
import { formatBytes } from "@/lib/consumption-format";
import type { BackupItem } from "@/types/backups";
import { BackupActions } from "./backup-actions";

const STATUS: Record<BackupItem["status"], [string, string]> = {
  RUNNING: ["En curso", "bg-[#e7efff] text-[#2357b8]"],
  COMPLETED: ["Completo", "bg-mint/15 text-[#0b7a66]"],
  FAILED: ["Falló", "bg-destructive/10 text-destructive"],
};

function details(b: BackupItem): string {
  return [
    `${b.source === "IMPORTED" ? "Importado por" : "Creado por"} ${b.createdBy.name}`,
    b.sizeBytes !== null && `${formatBytes(b.sizeBytes)} cifrado`,
    b.databaseBytes !== null && `base de datos ${formatBytes(b.databaseBytes)}`,
    b.fileCount !== null && `${b.fileCount} archivos en el bucket (${formatBytes(b.filesBytes ?? 0)})`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function BackupList({ items, canManage }: { items: BackupItem[]; canManage: boolean }) {
  if (items.length === 0) return <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Todavía no hay backups.</p>;
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card text-sm shadow-sm">
      {items.map((b) => {
        const [label, tone] = STATUS[b.status];
        return (
          <li key={b.id} className="grid gap-2 p-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="grid min-w-0 gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <b>{formatDateTime(b.startedAt)}</b>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", tone)}>{label}</span>
                {b.source === "IMPORTED" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">Importado</span>}
              </span>
              <span className="text-xs text-muted-foreground">{details(b)}</span>
              {b.errorMessage && <span className="break-words font-mono text-xs text-destructive">{b.errorMessage}</span>}
            </div>
            {canManage && <BackupActions id={b.id} downloadable={b.downloadable} deletable={b.status !== "RUNNING"} />}
          </li>
        );
      })}
    </ul>
  );
}
