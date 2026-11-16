import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownToLine, CircleCheck, ImageOff, Pencil, Sparkles } from "lucide-react";
import { MovementDialog } from "@/components/inventory/movement-dialog";
import { MovementList } from "@/components/inventory/movement-list";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { StockBadge } from "@/components/products/stock-badge";
import { Button } from "@modaflow/ui/components/ui/button";
import { api } from "@/lib/api";
import { CatalogPublishRow } from "@/components/catalog-admin/catalog-publish-row";
import { getDashboardContext, getProduct } from "@/lib/dal";
import { formatDate, formatMoney, variantLabel } from "@modaflow/ui/lib/format";
import type { Movement, Paginated } from "@/lib/types";

export const metadata: Metadata = { title: "Producto" };

// Per-request page (reads the session through the API).
export const instant = false;


export default async function ProductDetailPage({ params, searchParams }: PageProps<"/dashboard/productos/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [{ me, subscription }, product] = await Promise.all([getDashboardContext(), getProduct(id)]);
  if (!product) notFound();
  const movements = await api<Paginated<Movement>>(`/inventory/movements?productId=${product.id}&pageSize=10`);

  const canAdmin = me.membership.role === "OWNER" || me.membership.role === "ADMIN";
  const canOperate = subscription.isOperational;
  const primary = product.images.find((i) => i.isPrimary) ?? product.images[0];
  const margin =
    product.purchasePrice && Number(product.purchasePrice) > 0
      ? Number(product.salePrice) - Number(product.purchasePrice)
      : null;

  return (
    <div className="grid gap-5">
      {(query.nuevo === "1" || query.guardado === "1") && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-mint/10 px-4 py-3 text-sm font-semibold text-[#0b7a66]">
          <CircleCheck className="size-5" aria-hidden="true" />
          {query.nuevo === "1" ? "Prenda registrada. Ya aparece en tu inventario." : "Cambios guardados."}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Photos */}
        <section aria-label="Fotos" className="grid gap-2">
          <div className="aspect-[4/5] overflow-hidden rounded-2xl border bg-muted">
            {primary?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
              <img src={primary.url} alt={product.name} className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-muted-foreground">
                <ImageOff className="size-8" aria-hidden="true" />
                <span className="sr-only">Sin fotos</span>
              </span>
            )}
          </div>
          {product.images.length > 1 && (
            <ul className="flex gap-2 overflow-x-auto pb-1">
              {product.images.map((img) => (
                <li key={img.id} className="shrink-0">
                  <a href={img.url ?? "#"} target="_blank" rel="noreferrer" className="block size-20 overflow-hidden rounded-xl border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed S3 URL */}
                    <img src={img.thumbUrl ?? ""} alt="" className="size-full object-cover" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Info */}
        <section aria-labelledby="product-title" className="grid content-start gap-4">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
            <h1 id="product-title" className="text-2xl font-extrabold tracking-tight">
              {product.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-2xl font-extrabold text-primary">{formatMoney(product.salePrice)}</span>
              <StockBadge status={product.stockStatus} units={product.totalStock} />
              {product.aiAssisted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-violet-strong">
                  <Sparkles className="size-3" aria-hidden="true" /> Registrada con IA
                </span>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["Categoría", product.category?.name ?? "—"],
              ["Tipo", product.garmentType ?? "—"],
              ["Color", [product.color, ...product.secondaryColors].filter(Boolean).join(", ") || "—"],
              ["Estilo", product.style ?? "—"],
              ["Precio de compra", product.purchasePrice ? formatMoney(product.purchasePrice) : "—"],
              ["Ganancia estimada", margin !== null ? `${formatMoney(margin.toFixed(2))} por unidad` : "—"],
              ["Registrada", `${formatDate(product.createdAt)} · ${product.createdBy}`],
              ["Aviso de stock bajo", product.lowStockThreshold > 0 ? `≤ ${product.lowStockThreshold} unidades` : "Sin aviso"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-muted/70 px-3 py-2">
                <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                <dd className="font-bold break-words">{value}</dd>
              </div>
            ))}
          </dl>
          {product.description && <p className="text-sm text-ink-2">{product.description}</p>}
          {product.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Etiquetas">
              {product.tags.map((t) => (
                <li key={t} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-violet-strong">
                  {t}
                </li>
              ))}
            </ul>
          )}

          {canAdmin && <CatalogPublishRow id={product.id} published={product.catalogPublished} enabled={subscription.features.onlineCatalog} />}

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="lg" className="h-11">
              <Link href={`/dashboard/productos/${product.id}/editar`}>
                <Pencil aria-hidden="true" /> Editar
              </Link>
            </Button>
            {canAdmin && subscription.isOperational && <DeleteProductButton productId={product.id} name={product.name} />}
          </div>
        </section>
      </div>

      {/* Stock by variant */}
      <section aria-labelledby="stock-title" className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="stock-title" className="text-lg font-extrabold">
            Stock por talla
          </h2>
          {canOperate && (
            <MovementDialog
              variants={product.variants}
              canAdjust={canAdmin}
              trigger={
                <Button size="lg" className="h-11 font-bold">
                  <ArrowDownToLine aria-hidden="true" /> Registrar movimiento
                </Button>
              }
            />
          )}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {product.variants.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/70 px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-bold">{variantLabel(v)}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{v.sku}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={v.stock === 0 ? "font-extrabold text-destructive" : "font-extrabold"}>{v.stock}</span>
                {canOperate && (
                  <MovementDialog
                    variants={product.variants}
                    defaultVariantId={v.id}
                    canAdjust={canAdmin}
                    trigger={
                      <button type="button" className="h-9 rounded-lg border bg-card px-2.5 text-xs font-bold text-primary">
                        Mover
                      </button>
                    }
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="history-title" className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 id="history-title" className="text-lg font-extrabold">
            Últimos movimientos
          </h2>
          {movements.total > movements.items.length && (
            <Link href={`/dashboard/inventario/movimientos?productId=${product.id}`} className="text-sm font-semibold text-primary">
              Ver todos ({movements.total})
            </Link>
          )}
        </div>
        <MovementList movements={movements.items} showProduct={false} />
      </section>
    </div>
  );
}
