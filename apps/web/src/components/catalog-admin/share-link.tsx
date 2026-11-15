"use client";

import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { useState } from "react";

export function ShareLink({ url, storeName, published }: { url: string; storeName: string; published: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: storeName, text: `Mira el catálogo de ${storeName}`, url });
        return;
      } catch {
        return;
      }
    }
    await copy();
  }

  const btn = "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-bold";
  return (
    <div className="grid gap-2">
      <p className="truncate rounded-xl bg-muted/60 px-3 py-2.5 font-mono text-sm" title={url}>
        {url}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className={`${btn} ${published ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!published}>
          <ExternalLink className="size-4" aria-hidden="true" /> Ver
        </a>
        <button type="button" onClick={copy} className={btn}>
          {copied ? <Check className="size-4 text-[#0b7a66]" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />} {copied ? "Copiado" : "Copiar"}
        </button>
        <button type="button" onClick={share} className={btn}>
          <Share2 className="size-4" aria-hidden="true" /> Compartir
        </button>
      </div>
    </div>
  );
}
