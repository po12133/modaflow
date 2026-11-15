"use client";

import { ImageOff, ZoomIn } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PublicProductDetail } from "@/types/catalog";

export function Gallery({ images, name }: { images: PublicProductDetail["images"]; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const current = images[index];
  if (!current?.url) {
    return (
      <div className="grid aspect-[4/5] place-items-center rounded-3xl bg-muted text-muted-foreground">
        <ImageOff className="size-8" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <button type="button" onClick={() => setZoom(true)} className="relative overflow-hidden rounded-3xl bg-muted" aria-label="Ver foto ampliada">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed S3 URL */}
        <img src={current.url} alt={`${name}, foto ${index + 1} de ${images.length}`} width={current.width} height={current.height} fetchPriority="high" className="aspect-[4/5] w-full object-cover" />
        <span className="absolute right-3 bottom-3 grid size-9 place-items-center rounded-full bg-white/90 shadow">
          <ZoomIn className="size-4" aria-hidden="true" />
        </span>
      </button>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Fotos">
          {images.map((img, i) => (
            <li key={img.thumbUrl ?? i}>
              <button type="button" onClick={() => setIndex(i)} aria-label={`Ver foto ${i + 1}`} aria-current={i === index} className={cn("block size-16 overflow-hidden rounded-xl border-2", i === index ? "border-[var(--brand)]" : "border-transparent")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- signed S3 URL */}
                <img src={img.thumbUrl ?? img.url ?? ""} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-h-[95dvh] max-w-[min(96vw,900px)] overflow-auto p-2 sm:max-w-[min(96vw,900px)]">
          <DialogTitle className="sr-only">{name}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed S3 URL */}
          <img src={current.url} alt={name} className="h-auto w-full rounded-xl" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
