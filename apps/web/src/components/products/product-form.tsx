"use client";

import { CircleAlert, LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  analyzeGarmentAction,
  createProductAction,
  type ActionResult,
  updateProductAction,
} from "@/actions/products";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import type { AiUsage, Category, GarmentSuggestion, ProductDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { type Photo, PhotoUploader, photosFromImages } from "./photo-uploader";
import { TagInput } from "./tag-input";
import { newRow, VariantEditor, type VariantMode, type VariantRow } from "./variant-editor";

const NEW_CATEGORY = "__new__";
const COLOR_SUGGESTIONS = ["Negro", "Blanco", "Rojo", "Azul", "Azul marino", "Celeste", "Verde", "Amarillo", "Rosado", "Fucsia", "Morado", "Beige", "Café", "Gris", "Naranja", "Multicolor"];
const TYPE_SUGGESTIONS = ["Blusa", "Camisa", "Polera", "Pantalón", "Jean", "Vestido", "Falda", "Short", "Chaqueta", "Saco", "Chompa", "Conjunto", "Accesorio"];

interface Props {
  mode: "create" | "edit";
  product?: ProductDetail;
  categories: Category[];
  aiUsage: AiUsage | null;
  productLimit: { used: number; limit: number };
  canOperate: boolean;
}

type Errors = Record<string, string[] | undefined>;

export function ProductForm({ mode, product, categories, aiUsage, productLimit, canOperate }: Props) {
  const router = useRouter();
  const [draftId] = useState(() => product?.id ?? crypto.randomUUID());
  const [photos, setPhotos] = useState<Photo[]>(() => (product ? photosFromImages(product.images) : []));
  const [primaryKey, setPrimaryKey] = useState<string | null>(() => product?.images.find((i) => i.isPrimary)?.id ?? null);

  const [name, setName] = useState(product?.name ?? "");
  const [salePrice, setSalePrice] = useState(product?.salePrice ?? "");
  const [purchasePrice, setPurchasePrice] = useState(product?.purchasePrice ?? "");
  const [categoryId, setCategoryId] = useState(product?.category?.id ?? "");
  const [newCategory, setNewCategory] = useState("");
  const [garmentType, setGarmentType] = useState(product?.garmentType ?? "");
  const [color, setColor] = useState(product?.color ?? "");
  const [secondaryColors, setSecondaryColors] = useState((product?.secondaryColors ?? []).join(", "));
  const [style, setStyle] = useState(product?.style ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [tags, setTags] = useState<string[]>(product?.tags ?? []);
  const [sku, setSku] = useState(product?.sku ?? "");
  const [lowStockThreshold, setLowStockThreshold] = useState(product?.lowStockThreshold ?? 2);
  const [variantMode, setVariantMode] = useState<VariantMode>(mode === "edit" ? "sizes" : "single");
  const [rows, setRows] = useState<VariantRow[]>(() => (mode === "edit" ? [] : [newRow("", "", 1)]));

  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // AI state
  const [usage, setUsage] = useState(aiUsage);
  const [analyzing, startAnalyzing] = useTransition();
  const [aiNote, setAiNote] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [analysisId, setAnalysisId] = useState<string | undefined>();
  const analysisKeys = useRef(new Map<string, string>());

  const readyPhotos = photos.filter((p) => p.status === "ready" && p.id);
  const uploading = photos.some((p) => p.status === "uploading");
  const atLimit = mode === "create" && productLimit.used >= productLimit.limit;
  const aiBlockedReason = !usage?.available
    ? "La IA no está disponible por ahora. Completa los datos manualmente."
    : usage.remaining <= 0
      ? "Ya usaste tus análisis con IA de este periodo. Puedes registrar la prenda manualmente."
      : null;

  const categoryOptions = useMemo(() => categories.map((c) => ({ id: c.id, name: c.name })), [categories]);

  function applySuggestion(s: GarmentSuggestion) {
    if (!s.isGarment) {
      setAiNote({ tone: "warn", text: s.message || "No reconocimos una prenda en las fotos. Prueba con otra foto." });
      return;
    }
    if (s.name) setName(s.name);
    if (s.description) setDescription(s.description);
    if (s.garmentType) setGarmentType(s.garmentType);
    if (s.color) setColor(s.color);
    if (s.secondaryColors.length) setSecondaryColors(s.secondaryColors.join(", "));
    if (s.style) setStyle(s.style);
    if (s.tags.length) setTags((prev) => [...new Set([...prev, ...s.tags])].slice(0, 20));
    if (s.category) setCategoryId(s.category.id);
    else if (s.suggestedCategory) {
      setCategoryId(NEW_CATEGORY);
      setNewCategory(s.suggestedCategory);
    }
    if (s.size && mode === "create") {
      setVariantMode("single");
      setRows((prev) => [{ ...(prev[0] ?? newRow()), size: s.size! }]);
    }
    setAiNote({
      tone: s.message ? "warn" : "ok",
      text: s.message || "Completamos los datos con IA. Revísalos y agrega el precio y la cantidad.",
    });
  }

  function analyze() {
    const imageIds = readyPhotos.slice(0, 4).map((p) => p.id!);
    // Same set of photos -> same key: retries never charge twice.
    const setKey = imageIds.join(",");
    let idempotencyKey = analysisKeys.current.get(setKey);
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID().replace(/-/g, "");
      analysisKeys.current.set(setKey, idempotencyKey);
    }
    setAiNote(null);
    startAnalyzing(async () => {
      const result = await analyzeGarmentAction({ imageIds, idempotencyKey });
      if (!result.ok) {
        setAiNote({ tone: "error", text: result.message });
        if (result.code === "PLAN_LIMIT_REACHED" && usage) setUsage({ ...usage, remaining: 0 });
        return;
      }
      if (usage) setUsage({ ...usage, ...result.data.usage });
      setAnalysisId(result.data.id);
      if (result.data.suggestion) applySuggestion(result.data.suggestion);
    });
  }

  function validVariantRows() {
    return (variantMode === "single" ? rows.slice(0, 1) : rows).map((r) => ({
      size: r.size,
      color: variantMode === "single" ? "" : r.color,
      quantity: r.quantity,
    }));
  }

  function submit() {
    setErrors({});
    setMessage(null);
    if (uploading) {
      setMessage("Espera a que terminen de subir las fotos.");
      return;
    }
    const primary = readyPhotos.find((p) => p.key === primaryKey) ?? readyPhotos[0];
    const common = {
      name,
      description,
      garmentType,
      color,
      secondaryColors: secondaryColors.split(",").map((c) => c.trim()).filter(Boolean),
      style,
      categoryId: categoryId && categoryId !== NEW_CATEGORY ? categoryId : null,
      categoryName: categoryId === NEW_CATEGORY ? newCategory : "",
      tags,
      salePrice: String(salePrice),
      purchasePrice: String(purchasePrice ?? ""),
      sku: mode === "edit" && sku === product?.sku ? "" : sku,
      lowStockThreshold: Number(lowStockThreshold) || 0,
      imageIds: readyPhotos.map((p) => p.id!),
      primaryImageId: primary?.id,
      aiAnalysisId: analysisId,
    };

    startSaving(async () => {
      let result: ActionResult<{ id: string }>;
      if (mode === "create") {
        result = await createProductAction({ ...common, id: draftId, variants: validVariantRows() });
      } else {
        result = await updateProductAction(product!.id, {
          ...common,
          variantsAdd: rows.filter((r) => r.size.trim() || r.color.trim()).map((r) => ({ size: r.size, color: r.color, quantity: r.quantity })),
        });
      }
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push(`/dashboard/productos/${result.data.id}${mode === "create" ? "?nuevo=1" : "?guardado=1"}`);
    });
  }

  const err = (field: string) => errors[field]?.[0];
  const variantError =
    err("variants") ?? Object.entries(errors).find(([k]) => k.startsWith("variants"))?.[1]?.[0] ?? err("variantsAdd");

  if (atLimit) {
    return (
      <Alert className="border-amber/40 bg-amber/10">
        <CircleAlert aria-hidden="true" />
        <AlertDescription className="text-ink-2">
          Alcanzaste el límite de {productLimit.limit} productos de tu plan. Archiva productos que ya no vendes o{" "}
          <Link href="/dashboard/suscripcion" className="font-bold text-primary underline">
            cambia de plan
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      {message && (
        <Alert role="alert" className="border-destructive/30 bg-destructive/5 text-destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription className="text-current">{message}</AlertDescription>
        </Alert>
      )}
      {!canOperate && (
        <Alert className="border-destructive/30 bg-destructive/5 text-destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription className="text-current">
            Tu suscripción no está activa: no puedes registrar ni editar prendas.
          </AlertDescription>
        </Alert>
      )}

      {/* 1. Photos + AI */}
      <section aria-labelledby="photos-title" className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <h2 id="photos-title" className="font-extrabold">
          Fotos de la prenda
        </h2>
        <PhotoUploader
          productId={draftId}
          photos={photos}
          onChange={setPhotos}
          primaryKey={primaryKey}
          onPrimaryChange={setPrimaryKey}
          disabled={!canOperate}
        />
        {mode === "create" && readyPhotos.length > 0 && (
          <div className="grid gap-2 rounded-xl bg-secondary/60 p-3">
            <Button
              type="button"
              size="lg"
              onClick={analyze}
              disabled={analyzing || uploading || Boolean(aiBlockedReason) || !canOperate}
              className="h-12 bg-brand-gradient text-base font-bold"
            >
              {analyzing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <WandSparkles aria-hidden="true" />}
              {analyzing ? "Analizando la prenda…" : "Analizar con IA"}
            </Button>
            <p className="text-center text-xs text-muted-foreground" aria-live="polite">
              {aiBlockedReason ??
                `${usage!.remaining} de ${usage!.limit} análisis disponibles${usage!.period === "TOTAL" ? " en tu prueba" : " este mes"} · 1 análisis por prenda`}
            </p>
          </div>
        )}
        {aiNote && (
          <p
            role={aiNote.tone === "error" ? "alert" : "status"}
            className={cn(
              "flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold",
              aiNote.tone === "ok" && "bg-mint/10 text-[#0b7a66]",
              aiNote.tone === "warn" && "bg-amber/10 text-[#7a4f00]",
              aiNote.tone === "error" && "bg-destructive/5 text-destructive",
            )}
          >
            <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {aiNote.text}
          </p>
        )}
      </section>

      {/* 2. Essentials */}
      <section aria-labelledby="data-title" className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm">
        <h2 id="data-title" className="font-extrabold">
          Datos de la prenda
        </h2>
        <FieldBox id="name" label="Nombre" error={err("name")}>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required placeholder="Ej. Blusa roja de manga larga" className="h-11 text-base md:text-sm" aria-invalid={Boolean(err("name"))} />
        </FieldBox>
        <div className="grid grid-cols-2 gap-3">
          <FieldBox id="salePrice" label="Precio de venta (Bs)" error={err("salePrice")}>
            <Input id="salePrice" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} inputMode="decimal" placeholder="0.00" required className="h-11 text-base font-bold md:text-sm" aria-invalid={Boolean(err("salePrice"))} />
          </FieldBox>
          <FieldBox id="purchasePrice" label="Precio de compra" optional error={err("purchasePrice")}>
            <Input id="purchasePrice" value={purchasePrice ?? ""} onChange={(e) => setPurchasePrice(e.target.value)} inputMode="decimal" placeholder="0.00" className="h-11 text-base md:text-sm" aria-invalid={Boolean(err("purchasePrice"))} />
          </FieldBox>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <FieldBox id="category" label="Categoría" optional error={err("categoryId") ?? err("categoryName")}>
            <select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm">
              <option value="">Sin categoría</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_CATEGORY}>+ Nueva categoría…</option>
            </select>
            {categoryId === NEW_CATEGORY && (
              <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nombre de la categoría" maxLength={60} aria-label="Nueva categoría" className="mt-2 h-11 text-base md:text-sm" />
            )}
          </FieldBox>
          <FieldBox id="garmentType" label="Tipo de prenda" optional error={err("garmentType")}>
            <Input id="garmentType" list="garment-types" value={garmentType} onChange={(e) => setGarmentType(e.target.value)} maxLength={60} placeholder="Ej. Blusa" className="h-11 text-base md:text-sm" />
            <datalist id="garment-types">{TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>
          </FieldBox>
          <FieldBox id="color" label="Color" optional error={err("color")}>
            <Input id="color" list="colors" value={color} onChange={(e) => setColor(e.target.value)} maxLength={40} placeholder="Ej. Rojo" className="h-11 text-base md:text-sm" />
            <datalist id="colors">{COLOR_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
          </FieldBox>
        </div>
      </section>

      {/* 3. Sizes and stock */}
      <section aria-labelledby="stock-title" className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <h2 id="stock-title" className="font-extrabold">
          {mode === "create" ? "Tallas y cantidad" : "Tallas y stock"}
        </h2>
        {mode === "edit" && product && (
          <div className="grid gap-2">
            <ul className="grid gap-1.5">
              {product.variants.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/70 px-3 py-2 text-sm">
                  <span className="font-semibold">{[v.size || "Talla única", v.color].filter(Boolean).join(" · ")}</span>
                  <span className="text-muted-foreground">
                    {v.stock} {v.stock === 1 ? "unidad" : "unidades"} · <span className="font-mono text-xs">{v.sku}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              El stock se cambia con entradas, salidas o ajustes en{" "}
              <Link href={`/dashboard/productos/${product.id}`} className="font-semibold text-primary">
                el detalle del producto
              </Link>
              , para que quede en el historial.
            </p>
            <p className="mt-2 text-sm font-semibold text-ink-2">Agregar tallas o colores nuevos</p>
          </div>
        )}
        {mode === "create" ? (
          <VariantEditor mode={variantMode} onModeChange={(m) => { setVariantMode(m); setRows(m === "single" ? [newRow("", "", rows[0]?.quantity ?? 1)] : rows.length ? rows : [newRow("M")]); }} rows={rows} onRowsChange={setRows} error={variantError} />
        ) : (
          <>
            {rows.length > 0 && <VariantEditor mode="sizes" onModeChange={() => undefined} rows={rows} onRowsChange={setRows} error={variantError} />}
            <button type="button" onClick={() => setRows((r) => [...r, newRow()])} className="h-10 justify-self-start rounded-xl border bg-card px-3 text-sm font-semibold">
              + Agregar talla
            </button>
          </>
        )}
      </section>

      {/* 4. Optional details */}
      <details className="group rounded-2xl border bg-card p-4 shadow-sm" open={mode === "edit" || undefined}>
        <summary className="cursor-pointer list-none font-extrabold">
          Más datos <span className="font-normal text-muted-foreground">(opcional)</span>
        </summary>
        <div className="mt-4 grid gap-4">
          <FieldBox id="description" label="Descripción breve" optional error={err("description")}>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} className="min-h-20 text-base md:text-sm" />
          </FieldBox>
          <FieldBox id="tags" label="Etiquetas" optional error={err("tags")} hint="Ayudan a encontrar la prenda: casual, verano, floral…">
            <TagInput id="tags" value={tags} onChange={setTags} />
          </FieldBox>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldBox id="style" label="Estilo" optional>
              <Input id="style" value={style} onChange={(e) => setStyle(e.target.value)} maxLength={60} placeholder="Ej. Casual" className="h-11 text-base md:text-sm" />
            </FieldBox>
            <FieldBox id="secondaryColors" label="Otros colores" optional hint="Separados por comas.">
              <Input id="secondaryColors" value={secondaryColors} onChange={(e) => setSecondaryColors(e.target.value)} maxLength={200} className="h-11 text-base md:text-sm" />
            </FieldBox>
            <FieldBox id="sku" label="Código / SKU" optional error={err("sku")} hint={mode === "create" ? "Si lo dejas vacío se genera solo." : undefined}>
              <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} maxLength={48} placeholder="Automático" className="h-11 font-mono text-base md:text-sm" />
            </FieldBox>
            <FieldBox id="lowStock" label="Avisar con stock bajo desde" optional hint="0 = sin aviso (útil para prendas únicas).">
              <Input id="lowStock" type="number" inputMode="numeric" min={0} max={10000} value={lowStockThreshold} onChange={(e) => setLowStockThreshold(Math.max(0, Math.trunc(Number(e.target.value) || 0)))} className="h-11 text-base md:text-sm" />
            </FieldBox>
          </div>
          <p className="text-sm text-muted-foreground">
            Fecha de registro: <b className="text-foreground">{formatDate(product?.createdAt ?? new Date().toISOString())}</b>
          </p>
        </div>
      </details>

      <div className="sticky bottom-20 z-20 flex gap-2 rounded-2xl border bg-white/95 p-2 shadow-lg backdrop-blur lg:bottom-4">
        <Button type="button" variant="outline" size="lg" className="h-12" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" className="h-12 flex-1 text-base font-bold" disabled={saving || uploading || !canOperate}>
          {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {saving ? "Guardando…" : mode === "create" ? "Guardar prenda" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

function FieldBox({
  id,
  label,
  optional,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-ink-2">
        {label}
        {optional && <span className="font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
