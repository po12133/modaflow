"use client";

import { Download } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

const options = { margin: 2, errorCorrectionLevel: "M" as const, color: { dark: "#16132b", light: "#ffffff" } };

function download(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}

export function CatalogQr({ url, slug }: { url: string; slug: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void QRCode.toString(url, { ...options, type: "svg" }).then((s) => alive && setSvg(s));
    return () => {
      alive = false;
    };
  }, [url]);

  async function png() {
    download(await QRCode.toDataURL(url, { ...options, width: 1024 }), `qr-catalogo-${slug}.png`);
  }

  function svgFile() {
    if (!svg) return;
    const blob = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    download(blob, `qr-catalogo-${slug}.svg`);
    setTimeout(() => URL.revokeObjectURL(blob), 1000);
  }

  return (
    <figure className="grid justify-items-center gap-3">
      <div className="size-48 rounded-2xl border bg-white p-2" role="img" aria-label={`Código QR que abre ${url}`}>
        {svg ? <div className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="size-full animate-pulse rounded-xl bg-muted" />}
      </div>
      <figcaption className="max-w-60 text-center text-xs text-muted-foreground">Abre tu catálogo. No es un QR de pago: no contiene montos ni datos bancarios.</figcaption>
      <div className="grid w-full grid-cols-2 gap-2">
        <button type="button" onClick={png} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border bg-card text-sm font-bold">
          <Download className="size-4" aria-hidden="true" /> PNG
        </button>
        <button type="button" onClick={svgFile} disabled={!svg} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border bg-card text-sm font-bold">
          <Download className="size-4" aria-hidden="true" /> SVG
        </button>
      </div>
    </figure>
  );
}
