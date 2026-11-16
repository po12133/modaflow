import type { Metadata } from "next";
import { AutoRefresh } from "@/components/backups/auto-refresh";
import { BackupList } from "@/components/backups/backup-list";
import { BackupReadiness } from "@/components/backups/backup-readiness";
import { BackupToolbar } from "@/components/backups/backup-toolbar";
import { getMe } from "@/lib/dal";
import { getBackups } from "@/services/backups";

export const metadata: Metadata = { title: "Backups" };

export const instant = false;

export default async function BackupsPage() {
  const [me, data] = await Promise.all([getMe(), getBackups()]);
  const superadmin = me?.role === "SUPERADMIN";
  const { ready } = data;
  const running = data.items.some((b) => b.status === "RUNNING");
  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Backups</h1>
        <p className="text-sm text-muted-foreground">
          Copia completa de la base de datos (panel admin y suscriptores) con el inventario de archivos del bucket. Cada backup se guarda cifrado en el S3 configurado,
          también los que importes.
        </p>
      </header>
      <BackupReadiness ready={ready} />
      {superadmin && <BackupToolbar canCreate={ready.storage && ready.encryption && ready.database && !running} canImport={ready.storage && ready.encryption} />}
      <BackupList items={data.items} canManage={superadmin} />
      <p className="text-xs text-muted-foreground">
        Los archivos están cifrados: solo se abren en el servidor con su clave. Restaurar reemplaza todos los datos y se hace desde el servidor (README → Backups). Las fotos y
        comprobantes viven en el bucket; protégelos activando el versionado del bucket en Hetzner.
      </p>
      <AutoRefresh active={running} />
    </div>
  );
}
