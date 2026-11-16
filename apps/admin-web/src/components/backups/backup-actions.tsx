"use client";

import { Download, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteBackupAction, downloadBackupAction } from "@/actions/backups";

const btn = "inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-xs font-bold disabled:opacity-60";

export function BackupActions({ id, downloadable, deletable }: { id: string; downloadable: boolean; deletable: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function download() {
    setError(null);
    start(async () => {
      const res = await downloadBackupAction(id);
      if (res.ok) window.location.assign(res.data.url);
      else setError(res.message);
    });
  }

  function remove() {
    if (!window.confirm("¿Eliminar este backup? Se borra también su archivo del S3 y no se puede deshacer.")) return;
    setError(null);
    start(async () => {
      const res = await deleteBackupAction(id);
      if (!res.ok) setError(res.message);
    });
  }

  return (
    <div className="grid justify-items-start gap-1 sm:justify-items-end">
      <div className="flex gap-1.5">
        {downloadable && (
          <button type="button" onClick={download} disabled={pending} className={btn}>
            <Download className="size-3.5" aria-hidden="true" /> Descargar
          </button>
        )}
        {deletable && (
          <button type="button" onClick={remove} disabled={pending} className={`${btn} text-destructive`}>
            <Trash2 className="size-3.5" aria-hidden="true" /> Eliminar
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-destructive">{error}</p>}
    </div>
  );
}
