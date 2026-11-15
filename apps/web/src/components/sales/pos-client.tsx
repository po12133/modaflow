"use client";

import { ImageOff, LoaderCircle, Minus, PackageX, Plus, Search, ShoppingCart, Tag, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { searchPosProductsAction } from "@/actions/sales";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@modaflow/ui/components/ui/dialog";
import { Input } from "@modaflow/ui/components/ui/input";
import { formatMoney, variantLabel } from "@modaflow/ui/lib/format";
import { computeSale, fromCents, SaleRuleError, type SaleTotals, toCents } from "@/lib/sale-math";
import type { Category, Discount, PosProduct, Variant } from "@/lib/types";
import { cn } from "@modaflow/ui/lib/utils";
import { CheckoutDialog } from "./checkout-dialog";

export interface CartLine {
  variantId: string;
  productId: string;
  name: string;
  sku: string;
  size: string | null;
  color: string | null;
  thumbUrl: string | null;
  unitPrice: string;
  /** Stock shown when added (the backend re-checks it when confirming). */
  available: number;
  quantity: number;
  discount: Discount | null;
}

const STORAGE_KEY = "mf_pos_cart_v1";

export function computeCart(
  lines: CartLine[],
  general: Discount | null,
): { totals: SaleTotals | null; errors: Record<string, string> } {
  if (lines.length === 0) return { totals: null, errors: {} };
  const clean = (d: Discount | null) => (d && d.value.trim() ? { type: d.type, value: d.value.trim() } : null);
  try {
    return {
      totals: computeSale(
        lines.map((l) => ({
          unitPriceCents: toCents(l.unitPrice),
          quantity: l.quantity,
          discount: clean(l.discount),
        })),
        clean(general),
      ),
      errors: {},
    };
  } catch (error) {
    if (error instanceof SaleRuleError) return { totals: null, errors: { [error.field]: error.message } };
    throw error;
  }
}

export function PosClient({
  categories,
  initial,
  storeName,
}: {
  categories: Category[];
  initial: PosProduct[];
  storeName: string;
}) {
  const [products, setProducts] = useState(initial);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [showOut, setShowOut] = useState(false);
  const [loading, startLoading] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [general, setGeneral] = useState<Discount | null>(null);
  const [restored, setRestored] = useState(false);
  const [picker, setPicker] = useState<PosProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Keep the current sale if the page reloads or a request fails (UI draft only, not business data).
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
      // Restored after hydration on purpose (sessionStorage does not exist on the server).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved?.cart) setCart(saved.cart);
      if (saved?.general) setGeneral(saved.general);
    } catch {
      /* ignore */
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      if (cart.length) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ cart, general }));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [cart, general, restored]);

  const load = useCallback((s: string, cat: string | null, out: boolean) => {
    startLoading(async () => {
      const result = await searchPosProductsAction({
        search: s,
        categoryId: cat ?? undefined,
        includeOutOfStock: out,
      });
      if (result.ok) {
        setProducts(result.data.items);
        setLoadError(null);
      } else setLoadError(result.message);
    });
  }, []);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => load(search, categoryId, showOut), 300);
    return () => clearTimeout(t);
  }, [search, categoryId, showOut, load]);

  function notify(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }

  function addVariant(product: PosProduct, variant: Variant) {
    if (variant.stock <= 0) return;
    const existing = cart.find((l) => l.variantId === variant.id);
    if (existing) {
      if (existing.quantity >= existing.available) {
        notify(`No hay más stock de ${product.name}`);
        return;
      }
      setCart((c) => c.map((l) => (l.variantId === variant.id ? { ...l, quantity: l.quantity + 1 } : l)));
    } else {
      setCart((c) => [
        ...c,
        {
          variantId: variant.id,
          productId: product.id,
          name: product.name,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          thumbUrl: product.image?.thumbUrl ?? null,
          unitPrice: product.salePrice,
          available: variant.stock,
          quantity: 1,
          discount: null,
        },
      ]);
    }
    notify(`Agregado: ${product.name}${variant.size ? ` (${variant.size})` : ""}`);
  }

  function onProductTap(product: PosProduct) {
    const sellable = product.variants.filter((v) => v.stock > 0);
    if (sellable.length === 0) return;
    // One-off garments and single-size products are added with a single tap.
    if (product.variants.length === 1) addVariant(product, product.variants[0]!);
    else setPicker(product);
  }

  const { totals, errors } = useMemo(() => computeCart(cart, general), [cart, general]);
  const units = cart.reduce((s, l) => s + l.quantity, 0);
  const totalLabel = totals ? formatMoney(fromCents(totals.totalCents)) : "Bs 0";

  function onSold() {
    setCart([]);
    setGeneral(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function updateAvailability(variantId: string, available: number) {
    setCart((c) =>
      c.map((l) =>
        l.variantId === variantId
          ? {
              ...l,
              available,
              quantity: Math.min(l.quantity, Math.max(available, 1)),
            }
          : l,
      ),
    );
    load(search, categoryId, showOut);
  }

  const cartPanel = (
    <CartPanel
      cart={cart}
      setCart={setCart}
      general={general}
      setGeneral={setGeneral}
      totals={totals}
      errors={errors}
      onCheckout={() => {
        setCartOpen(false);
        setCheckoutOpen(true);
      }}
    />
  );

  return (
    <div className="grid gap-4 pb-24 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:pb-0">
      <section aria-label="Prendas" className="grid min-w-0 content-start gap-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar prenda, código, color, talla…"
            aria-label="Buscar prendas"
            enterKeyHint="search"
            className="h-12 rounded-2xl bg-card pl-10 text-base"
          />
          {loading && (
            <LoaderCircle
              className="absolute top-1/2 right-3 size-5 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-label="Buscando"
            />
          )}
        </div>
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0"
          role="group"
          aria-label="Categorías"
        >
          {[
            { id: null, name: "Todo" },
            ...categories.map((c) => ({
              id: c.id as string | null,
              name: c.name,
            })),
          ].map((c) => (
            <button
              key={c.id ?? "all"}
              type="button"
              onClick={() => setCategoryId(c.id)}
              aria-pressed={categoryId === c.id}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold",
                categoryId === c.id ? "border-foreground bg-foreground text-white" : "bg-card text-ink-2",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showOut}
            onChange={(e) => setShowOut(e.target.checked)}
            className="size-4 accent-[#6c4cf5]"
          />
          Mostrar agotados
        </label>

        {loadError && (
          <p role="alert" className="rounded-xl bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive">
            {loadError}
          </p>
        )}

        {products.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            <PackageX className="mb-2 size-8" aria-hidden="true" />
            {search || categoryId ? "No hay prendas que coincidan." : "No hay prendas con stock para vender."}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-busy={loading}>
            {products.map((p) => {
              const out = p.totalStock <= 0;
              const inCart = cart.filter((l) => l.productId === p.id).reduce((s, l) => s + l.quantity, 0);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onProductTap(p)}
                    disabled={out}
                    aria-label={`${p.name}, ${formatMoney(p.salePrice)}, ${out ? "agotado" : `${p.totalStock} disponibles`}${inCart ? `, ${inCart} en la venta` : ""}`}
                    className={cn(
                      "relative block w-full overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-transform active:scale-[0.98]",
                      out && "opacity-60",
                      inCart > 0 && "ring-2 ring-primary",
                    )}
                  >
                    <div className="relative aspect-square bg-muted">
                      {p.image?.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
                        <img src={p.image.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <span className="grid size-full place-items-center text-muted-foreground">
                          <ImageOff className="size-6" aria-hidden="true" />
                        </span>
                      )}
                      {inCart > 0 && (
                        <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-primary text-xs font-extrabold text-white">
                          {inCart}
                        </span>
                      )}
                      {out && (
                        <span className="absolute inset-x-2 bottom-2 rounded-full bg-destructive px-2 py-0.5 text-center text-xs font-bold text-white">
                          Agotado
                        </span>
                      )}
                    </div>
                    <div className="grid gap-0.5 p-2.5">
                      <span className="line-clamp-2 text-sm leading-tight font-bold">{p.name}</span>
                      <span className="flex items-baseline justify-between gap-1">
                        <b className="text-base">{formatMoney(p.salePrice)}</b>
                        {!out && <span className="text-xs text-muted-foreground">{p.totalStock} disp.</span>}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {p.variants.length === 1
                          ? variantLabel(p.variants[0]!)
                          : `${p.variants.filter((v) => v.stock > 0).length} tallas/colores`}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Desktop: sale summary always visible */}
      <aside aria-label="Venta actual" className="sticky top-20 hidden rounded-2xl border bg-card p-4 shadow-sm lg:block">
        {cartPanel}
      </aside>

      {/* Mobile: fixed bar above the bottom navigation */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2 lg:hidden">
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="flex h-14 w-full items-center justify-between rounded-2xl bg-brand-gradient px-4 font-bold text-white shadow-[0_12px_28px_-10px_rgba(176,76,240,0.8)]"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="size-5" aria-hidden="true" />
            Ver venta ({units})
          </span>
          <span className="text-lg">{totalLabel}</span>
        </button>
      </div>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4">
        {toast && <p className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-white shadow-lg">{toast}</p>}
      </div>

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="top-auto bottom-0 left-0 max-h-[90dvh] w-full max-w-full translate-x-0 translate-y-0 overflow-y-auto rounded-b-none sm:max-w-full lg:hidden">
          <DialogHeader>
            <DialogTitle>Venta actual</DialogTitle>
            <DialogDescription className="sr-only">Prendas, descuentos y total de la venta.</DialogDescription>
          </DialogHeader>
          {cartPanel}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(picker)} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{picker?.name}</DialogTitle>
            <DialogDescription>Elige la talla o el color · {picker ? formatMoney(picker.salePrice) : ""}</DialogDescription>
          </DialogHeader>
          <ul className="grid grid-cols-2 gap-2">
            {picker?.variants.map((v) => {
              const inCart = cart.find((l) => l.variantId === v.id)?.quantity ?? 0;
              const left = v.stock - inCart;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    disabled={left <= 0}
                    onClick={() => {
                      addVariant(picker, v);
                      setPicker(null);
                    }}
                    className="grid min-h-16 w-full content-center gap-0.5 rounded-xl border bg-card px-3 py-2 text-left disabled:opacity-40"
                  >
                    <span className="font-bold">{variantLabel(v)}</span>
                    <span className={cn("text-xs", v.stock <= 0 ? "font-bold text-destructive" : "text-muted-foreground")}>
                      {v.stock <= 0 ? "Agotado" : `${left} disponible${left === 1 ? "" : "s"}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>

      {checkoutOpen && (
        <CheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          cart={cart}
          general={general}
          storeName={storeName}
          onSold={onSold}
          onStockChanged={updateAvailability}
        />
      )}
    </div>
  );
}

function DiscountEditor({
  value,
  onChange,
  label,
  error,
}: {
  value: Discount | null;
  onChange: (d: Discount | null) => void;
  label: string;
  error?: string;
}) {
  const type = value?.type ?? "AMOUNT";
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label={`${label}: tipo`}>
          {(["AMOUNT", "PERCENT"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => onChange({ type: t, value: value?.value ?? "" })}
              className={cn(
                "h-8 min-w-10 rounded-md px-2 text-sm font-bold",
                type === t ? "bg-white text-violet-strong shadow-sm" : "text-ink-2",
              )}
            >
              {t === "AMOUNT" ? "Bs" : "%"}
            </button>
          ))}
        </div>
        <Input
          inputMode="decimal"
          value={value?.value ?? ""}
          onChange={(e) => onChange(e.target.value.trim() === "" ? null : { type, value: e.target.value.replace(",", ".") })}
          placeholder="0"
          aria-label={label}
          aria-invalid={Boolean(error)}
          className="h-9 w-24 text-base md:text-sm"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground"
            aria-label={`Quitar ${label.toLowerCase()}`}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

function CartPanel({
  cart,
  setCart,
  general,
  setGeneral,
  totals,
  errors,
  onCheckout,
}: {
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  general: Discount | null;
  setGeneral: (d: Discount | null) => void;
  totals: SaleTotals | null;
  errors: Record<string, string>;
  onCheckout: () => void;
}) {
  const [openDiscount, setOpenDiscount] = useState<string | null>(null);
  const update = (variantId: string, patch: Partial<CartLine>) =>
    setCart((c) => c.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)));

  if (cart.length === 0) {
    return (
      <div className="grid place-items-center gap-2 py-8 text-center text-sm text-muted-foreground">
        <ShoppingCart className="size-8" aria-hidden="true" />
        Toca una prenda para agregarla a la venta.
      </div>
    );
  }

  const hasErrors = Object.keys(errors).length > 0;
  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {cart.map((line, i) => {
          const lineResult = totals?.lines[i];
          const discountError = errors[`items.${i}.discount`];
          return (
            <li key={line.variantId} className="rounded-xl border bg-card p-2.5">
              <div className="flex gap-2.5">
                <span className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {line.thumbUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- signed S3 URL
                    <img src={line.thumbUrl} alt="" className="size-full object-cover" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{line.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {variantLabel(line)} · <span className="font-mono">{line.sku}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(line.unitPrice)}
                    {lineResult && lineResult.unitDiscountCents > 0 && (
                      <>
                        {" "}
                        → <b className="text-mint">{formatMoney(fromCents(lineResult.finalUnitPriceCents))}</b>
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCart((c) => c.filter((l) => l.variantId !== line.variantId))}
                  className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:text-destructive"
                  aria-label={`Quitar ${line.name}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center rounded-xl border" role="group" aria-label={`Cantidad de ${line.name}`}>
                  <button
                    type="button"
                    onClick={() =>
                      line.quantity > 1
                        ? update(line.variantId, {
                            quantity: line.quantity - 1,
                          })
                        : setCart((c) => c.filter((l) => l.variantId !== line.variantId))
                    }
                    className="grid size-10 place-items-center"
                    aria-label="Restar una unidad"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <span className="w-8 text-center font-bold" aria-live="polite">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => update(line.variantId, { quantity: line.quantity + 1 })}
                    disabled={line.quantity >= line.available}
                    className="grid size-10 place-items-center disabled:opacity-30"
                    aria-label="Sumar una unidad"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenDiscount(openDiscount === line.variantId ? null : line.variantId)}
                  aria-expanded={openDiscount === line.variantId}
                  className={cn(
                    "inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold",
                    line.discount ? "bg-mint/10 text-[#0b7a66]" : "text-primary",
                  )}
                >
                  <Tag className="size-3.5" aria-hidden="true" />
                  {line.discount
                    ? `Desc. ${line.discount.type === "PERCENT" ? `${line.discount.value}%` : `Bs ${line.discount.value}`}`
                    : "Descuento"}
                </button>
                <b className="text-sm">{lineResult ? formatMoney(fromCents(lineResult.lineTotalCents)) : "—"}</b>
              </div>
              {line.quantity >= line.available && (
                <p className="mt-1 text-[0.7rem] text-muted-foreground">Máximo disponible: {line.available}</p>
              )}
              {(openDiscount === line.variantId || discountError) && (
                <div className="mt-2 border-t pt-2">
                  <DiscountEditor
                    label="Descuento por unidad"
                    value={line.discount}
                    onChange={(d) => update(line.variantId, { discount: d })}
                    error={discountError}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="grid gap-1.5 rounded-xl bg-muted/60 p-3">
        <p className="text-sm font-semibold text-ink-2">Descuento general</p>
        <DiscountEditor label="Descuento general" value={general} onChange={setGeneral} error={errors.discount} />
      </div>

      <dl className="grid gap-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>{totals ? formatMoney(fromCents(totals.subtotalCents)) : "—"}</dd>
        </div>
        {totals && totals.itemsDiscountCents + totals.discountCents > 0 && (
          <div className="flex justify-between text-[#0b7a66]">
            <dt>Descuentos</dt>
            <dd>- {formatMoney(fromCents(totals.itemsDiscountCents + totals.discountCents))}</dd>
          </div>
        )}
        <div className="flex justify-between border-t pt-1.5 text-lg font-extrabold">
          <dt>Total</dt>
          <dd>{totals ? formatMoney(fromCents(totals.totalCents)) : "—"}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={onCheckout}
        disabled={hasErrors || !totals}
        className="h-14 rounded-2xl bg-primary text-base font-extrabold text-white shadow-lg disabled:opacity-50"
      >
        Finalizar venta
      </button>
    </div>
  );
}
