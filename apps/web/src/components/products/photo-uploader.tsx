"use client";

import { ArrowLeft, ArrowRight, Camera, ImagePlus, LoaderCircle, Star, TriangleAlert, X } from "lucide-react";
import { useRef } from "react";
import { deletePendingImageAction } from "@/actions/products";
import type { ProductImage } from "@/lib/types";
import { cn } from "@modaflow/ui/lib/utils";

export const MAX_PHOTOS = 6;
const ACCEPTED = /^image\/(jpeg|png|webp)$/;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export interface Photo {
  /** Local key (stable while uploading); equals the image id once uploaded. */
  key: string;
  id?: string;
  preview: string;
  status: "uploading" | "ready" | "error";
  error?: string;
  /** Already saved with the product (edit mode): removal happens on save. */
  saved?: boolean;
}

export function photosFromImages(images: ProductImage[]): Photo[] {
  return images.map((img) => ({ key: img.id, id: img.id, preview: img.thumbUrl ?? img.url ?? "", status: "ready", saved: true }));
}

/**
 * Downscales camera photos in the browser before uploading (max 2000px,
 * JPEG 85%): a 6 MB photo becomes ~300 KB, which matters on mobile data.
 * The server validates and re-encodes it anyway.
 */
async function prepareForUpload(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 2_500_000 && ACCEPTED.test(file.type)) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85),
    );
  } catch {
    return file; // Let the server decide (it rejects unsupported formats).
  }
}

async function uploadPhoto(productId: string, blob: Blob): Promise<ProductImage> {
  const form = new FormData();
  form.append("productId", productId);
  form.append("file", blob, "foto.jpg");
  const res = await fetch("/api/product-images", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.message === "string" ? body.message : "No pudimos subir la foto.");
  return body as ProductImage;
}

interface PhotoUploaderProps {
  productId: string;
  photos: Photo[];
  onChange: (update: (prev: Photo[]) => Photo[]) => void;
  primaryKey: string | null;
  onPrimaryChange: (key: string) => void;
  disabled?: boolean;
}

export function PhotoUploader({ productId, photos, onChange, primaryKey, onPrimaryChange, disabled }: PhotoUploaderProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const remaining = MAX_PHOTOS - photos.length;

  async function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).slice(0, remaining);
    for (const file of files) {
      const key = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      const invalid =
        !file.type.startsWith("image/")
          ? "El archivo no es una imagen."
          : file.size > MAX_INPUT_BYTES
            ? "La foto es demasiado grande."
            : null;
      onChange((prev) => [...prev, { key, preview, status: invalid ? "error" : "uploading", error: invalid ?? undefined }]);
      if (invalid) continue;
      try {
        const image = await uploadPhoto(productId, await prepareForUpload(file));
        onChange((prev) => prev.map((p) => (p.key === key ? { ...p, id: image.id, status: "ready" } : p)));
      } catch (error) {
        onChange((prev) =>
          prev.map((p) => (p.key === key ? { ...p, status: "error", error: (error as Error).message } : p)),
        );
      }
    }
  }

  function remove(photo: Photo) {
    onChange((prev) => prev.filter((p) => p.key !== photo.key));
    // Uploaded during this session but not saved: delete it now. Saved photos are removed when saving.
    if (photo.id && !photo.saved) void deletePendingImageAction(photo.id);
    if (photo.preview.startsWith("blob:")) URL.revokeObjectURL(photo.preview);
  }

  function move(index: number, delta: -1 | 1) {
    onChange((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  const effectivePrimary = primaryKey && photos.some((p) => p.key === primaryKey) ? primaryKey : photos[0]?.key;

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={disabled || remaining <= 0}
          onClick={() => cameraRef.current?.click()}
          className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl bg-brand-gradient p-3 font-bold text-white shadow-[0_16px_30px_-18px_rgba(22,19,43,0.6)] active:scale-[0.98] disabled:opacity-50"
        >
          <Camera className="size-7" aria-hidden="true" />
          Tomar fotografía
        </button>
        <button
          type="button"
          disabled={disabled || remaining <= 0}
          onClick={() => galleryRef.current?.click()}
          className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-primary/40 bg-secondary/60 p-3 font-bold text-violet-strong active:scale-[0.98] disabled:opacity-50"
        >
          <ImagePlus className="size-7" aria-hidden="true" />
          Seleccionar imágenes
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">
        Hasta {MAX_PHOTOS} fotos (JPG, PNG o WebP). La primera o la marcada con estrella es la principal.
      </p>

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Fotos de la prenda">
          {photos.map((photo, i) => {
            const isPrimary = photo.key === effectivePrimary;
            return (
              <li
                key={photo.key}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-xl border bg-muted",
                  isPrimary && photo.status === "ready" && "ring-2 ring-primary",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob/signed URLs */}
                <img src={photo.preview} alt={`Foto ${i + 1}`} className="size-full object-cover" />
                {photo.status === "uploading" && (
                  <div className="absolute inset-0 grid place-items-center bg-black/40 text-white" role="status">
                    <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
                    <span className="sr-only">Subiendo foto…</span>
                  </div>
                )}
                {photo.status === "error" && (
                  <div className="absolute inset-0 grid place-items-center bg-destructive/80 p-1 text-center text-[0.65rem] leading-tight font-semibold text-white" role="alert">
                    <TriangleAlert className="mx-auto size-4" aria-hidden="true" />
                    {photo.error}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => remove(photo)}
                  aria-label={`Quitar foto ${i + 1}`}
                  className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-black/60 text-white"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
                {photo.status === "ready" && (
                  <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => onPrimaryChange(photo.key)}
                      aria-label={isPrimary ? `Foto ${i + 1}: principal` : `Usar foto ${i + 1} como principal`}
                      aria-pressed={isPrimary}
                      className={cn(
                        "grid size-8 place-items-center rounded-full",
                        isPrimary ? "bg-primary text-white" : "bg-white/85 text-ink-2",
                      )}
                    >
                      <Star className={cn("size-4", isPrimary && "fill-current")} aria-hidden="true" />
                    </button>
                    <span className="flex gap-1">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Mover foto ${i + 1} antes`} className="grid size-8 place-items-center rounded-full bg-white/85 text-ink-2 disabled:opacity-30">
                        <ArrowLeft className="size-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1} aria-label={`Mover foto ${i + 1} después`} className="grid size-8 place-items-center rounded-full bg-white/85 text-ink-2 disabled:opacity-30">
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
