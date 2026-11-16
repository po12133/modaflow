"use client";

import { DatabaseBackup, LoaderCircle, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createBackupAction } from "@/actions/backups";

const btn = "inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-60";

export function BackupToolbar({ canCreate, canImport }: { canCreate: boolean; canImport: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function create() {
    setMessage(null);
    start(async () => {
      const res = await createBackupAction();
      setMessage(res.ok ? { ok: true, text: "Backup en curso. Aparecerá completo en la lista en unos segundos." } : { ok: false, text: res.message });
    });
  }

  function importFile(file: File) {
    setMessage(null);
    start(async () => {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/backups/import", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setMessage(res.ok ? { ok: true, text: "Backup importado y guardado en el S3." } : { ok: false, text: data?.message ?? "No se pudo importar el backup." });
      if (res.ok) router.refresh();
    });
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) importFile(file);
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={create} disabled={!canCreate || pending} className={`${btn} bg-primary text-white`}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <DatabaseBackup className="size-4" aria-hidden="true" />}
          Crear backup ahora
        </button>
        <button type="button" onClick={() => input.current?.click()} disabled={!canImport || pending} className={`${btn} border bg-card`}>
          <Upload className="size-4" aria-hidden="true" /> Importar backup
        </button>
        <input ref={input} type="file" accept=".mfbackup,application/octet-stream" className="hidden" onChange={pick} />
      </div>
      {message && <p role="status" className={message.ok ? "text-sm font-semibold text-[#0b7a66]" : "text-sm font-semibold text-destructive"}>{message.text}</p>}
    </div>
  );
}
