"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { updateSettingsAction } from "@/actions/admin";

export function SettingsForm({ section, children, disabled }: { section: string; children: ReactNode; disabled: boolean }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      action={(form) =>
        start(async () => {
          const res = await updateSettingsAction(section, form);
          setMessage(res.ok ? { ok: true, text: "Configuración guardada." } : { ok: false, text: res.message });
        })
      }
      className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm"
    >
      <fieldset disabled={disabled} className="grid gap-3 disabled:opacity-60">
        {children}
        <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 justify-self-start rounded-xl bg-primary px-4 text-sm font-bold text-white">
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          Guardar
        </button>
      </fieldset>
      {message && <p role="status" className={message.ok ? "text-sm font-semibold text-[#0b7a66]" : "text-sm font-semibold text-destructive"}>{message.text}</p>}
    </form>
  );
}

export function QrUpload({ url, disabled }: { url: string | null; disabled: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function upload(file: File) {
    start(async () => {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/payment-qr", { method: "POST", body });
      if (res.ok) router.refresh();
      else setError(((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? "No se pudo subir el QR.");
    });
  }
  return (
    <div className="grid gap-2 rounded-2xl border bg-card p-4 shadow-sm">
      <b>QR bancario de ModaFlow</b>
      <p className="text-xs text-muted-foreground">Es el QR para cobrar suscripciones. No es el QR del catálogo ni el de cobro de las tiendas.</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed S3 URL */}
      {url ? <img src={url} alt="QR bancario de ModaFlow" className="size-48 rounded-xl border bg-white object-contain p-2" /> : <p className="text-sm text-muted-foreground">Sin QR cargado.</p>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button type="button" disabled={disabled || pending} onClick={() => input.current?.click()} className="h-10 justify-self-start rounded-xl border bg-card px-3 text-sm font-bold disabled:opacity-60">
        {pending ? "Subiendo…" : url ? "Cambiar QR" : "Subir QR"}
      </button>
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
