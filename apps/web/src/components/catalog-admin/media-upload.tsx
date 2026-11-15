"use client";

import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { removeCatalogMediaAction } from "@/actions/catalog";

interface MediaUploadProps {
  kind: "logo" | "cover";
  label: string;
  hint: string;
  url: string | null;
}

export function MediaUpload({ kind, label, hint, url }: MediaUploadProps) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function upload(file: File) {
    setError(null);
    start(async () => {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/catalog/media/${kind}`, { method: "POST", body });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? "No se pudo subir la imagen.");
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const res = await removeCatalogMediaAction(kind);
      if (!res.ok) setError(res.message);
    });
  }

  const preview = kind === "logo" ? "size-20 rounded-full" : "aspect-[16/7] w-full rounded-2xl";
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold text-ink-2">{label}</p>
      <div className={`${preview} relative grid place-items-center overflow-hidden border bg-muted`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
        {pending && (
          <span className="absolute inset-0 grid place-items-center bg-white/70">
            <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
          </span>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <div className="flex gap-2">
        <button type="button" onClick={() => input.current?.click()} disabled={pending} className="h-10 rounded-xl border bg-card px-3 text-sm font-bold">
          {url ? "Cambiar" : "Subir imagen"}
        </button>
        {url && (
          <button type="button" onClick={remove} disabled={pending} className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-destructive">
            <Trash2 className="size-4" aria-hidden="true" /> Quitar
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
