"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { formatDateTime } from "@modaflow/ui/lib/format";
import type { SetupLink } from "@/types/staff";

export function SetupLinkBox({ link }: { link: SetupLink }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(link.setupUrl).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div role="status" className="grid gap-2 rounded-xl bg-mint/10 p-3 text-sm">
      <b className="text-[#0b7a66]">Enlace listo. Se muestra una sola vez.</b>
      <div className="flex gap-2">
        <input readOnly value={link.setupUrl} aria-label="Enlace para definir la contraseña" onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-lg border bg-card px-2 font-mono text-xs" />
        <button type="button" onClick={copy} className="inline-flex h-10 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-bold text-white">
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="text-xs text-ink-2">Envíalo solo a esa persona por un canal privado. Sirve una vez y vence el {formatDateTime(link.expiresAt)}</p>
    </div>
  );
}
