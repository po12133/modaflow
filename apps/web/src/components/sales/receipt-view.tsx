import { formatDateTime, formatMoney, PAYMENT_LABELS, variantLabel } from "@modaflow/ui/lib/format";
import type { Receipt } from "@/lib/types";

/** Digital receipt (internal sale voucher, not a tax invoice). Server component; print-friendly. */
export function ReceiptView({ receipt }: { receipt: Receipt }) {
  const accent = /^#[0-9a-f]{6}$/i.test(receipt.store.primaryColor) ? receipt.store.primaryColor : "#6c4cf5";
  const canceled = receipt.status === "CANCELED";
  return (
    <article
      aria-label={`Comprobante ${receipt.number}`}
      className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border bg-white text-[#16132b] shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none"
    >
      <div className="h-2" style={{ backgroundColor: accent }} />
      <div className="grid gap-4 p-5">
        <header className="text-center">
          <h1 className="text-xl font-extrabold tracking-tight">{receipt.store.name}</h1>
          <p className="text-xs text-[#6c6889]">{[receipt.store.address, receipt.store.city].filter(Boolean).join(" · ")}</p>
          <p className="text-xs text-[#6c6889]">WhatsApp {receipt.store.whatsapp}</p>
        </header>

        <div className="border-t border-dashed pt-3 text-center">
          <p className="text-[0.65rem] font-extrabold tracking-[0.14em] uppercase" style={{ color: accent }}>
            Comprobante de venta
          </p>
          <p className="text-2xl font-extrabold">{receipt.number}</p>
          {canceled && <p className="mt-1 inline-block rounded-full bg-[#fde8e9] px-3 py-0.5 text-sm font-extrabold text-[#b4252c]">VENTA ANULADA</p>}
          <dl className="mt-2 grid grid-cols-2 gap-1 text-left text-xs">
            <dt className="text-[#6c6889]">Fecha</dt>
            <dd className="text-right font-semibold">{formatDateTime(receipt.createdAt)}</dd>
            <dt className="text-[#6c6889]">Vendedor</dt>
            <dd className="text-right font-semibold">{receipt.seller}</dd>
          </dl>
        </div>

        <ul className="grid gap-2.5 border-t border-dashed pt-3 text-sm">
          {receipt.items.map((item, i) => (
            <li key={`${item.sku}-${i}`}>
              <p className="font-bold">{item.productName}</p>
              <p className="text-xs text-[#6c6889]">{variantLabel(item)}</p>
              <div className="flex justify-between gap-2 text-xs">
                <span>
                  {item.quantity} × {formatMoney(item.unitPrice)}
                  {Number(item.unitDiscount) > 0 && <span className="text-[#0b7a66]"> − {formatMoney(item.unitDiscount)} desc.</span>}
                </span>
                <b className="text-sm">{formatMoney(item.lineTotal)}</b>
              </div>
            </li>
          ))}
        </ul>

        <dl className="grid gap-1 border-t border-dashed pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(receipt.subtotal)}</dd></div>
          {Number(receipt.itemsDiscount) > 0 && (
            <div className="flex justify-between text-[#6c6889]"><dt>Descuentos por prenda</dt><dd>− {formatMoney(receipt.itemsDiscount)}</dd></div>
          )}
          {Number(receipt.discountAmount) > 0 && (
            <div className="flex justify-between text-[#6c6889]">
              <dt>Descuento general{receipt.discountType === "PERCENT" ? ` (${Number(receipt.discountValue)} %)` : ""}</dt>
              <dd>− {formatMoney(receipt.discountAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between pt-1 text-xl font-extrabold"><dt>Total</dt><dd>{formatMoney(receipt.total)}</dd></div>
          <div className="flex justify-between text-xs"><dt className="text-[#6c6889]">Pago</dt><dd className="font-semibold">{PAYMENT_LABELS[receipt.paymentMethod]}</dd></div>
          {receipt.amountReceived && (
            <div className="flex justify-between text-xs"><dt className="text-[#6c6889]">Recibido</dt><dd>{formatMoney(receipt.amountReceived)}</dd></div>
          )}
          {receipt.changeGiven && (
            <div className="flex justify-between text-xs"><dt className="text-[#6c6889]">Cambio</dt><dd>{formatMoney(receipt.changeGiven)}</dd></div>
          )}
          <div className="flex justify-between text-xs"><dt className="text-[#6c6889]">Prendas</dt><dd>{receipt.unitCount}</dd></div>
        </dl>

        <footer className="border-t border-dashed pt-3 text-center">
          <p className="font-bold">¡Gracias por tu compra!</p>
          <p className="mt-1 text-[0.7rem] text-[#6c6889]">{receipt.notice}</p>
        </footer>
      </div>
    </article>
  );
}
