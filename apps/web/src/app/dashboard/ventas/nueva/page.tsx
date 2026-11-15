import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, History } from "lucide-react";
import { PosClient } from "@/components/sales/pos-client";
import { api } from "@/lib/api";
import { getCategories, getDashboardContext } from "@/lib/dal";
import type { Paginated, PosProduct } from "@/lib/types";

export const metadata: Metadata = { title: "Nueva venta" };

// Per-request page (reads the session through the API).
export const instant = false;

export default async function NewSalePage() {
  const [{ store, subscription }, categories, initial] = await Promise.all([
    getDashboardContext(),
    getCategories(),
    api<Paginated<PosProduct>>("/pos/products?pageSize=24"),
  ]);

  return (
    <div className="grid gap-3">
      <header className="flex items-center gap-3">
        <Link href="/dashboard" className="grid size-10 shrink-0 place-items-center rounded-xl border bg-card" aria-label="Volver al inicio">
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{store.name}</p>
          <h1 className="text-xl font-extrabold tracking-tight">Nueva venta</h1>
        </div>
        <Link href="/dashboard/ventas" className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-semibold">
          <History className="size-4" aria-hidden="true" /> Historial
        </Link>
      </header>
      {subscription.isOperational ? (
        <PosClient categories={categories} initial={initial.items} storeName={store.name} />
      ) : (
        <p className="rounded-2xl bg-[#fdeeee] p-4 text-sm text-[#9b1f26]">
          Tu suscripción no está activa: no puedes registrar ventas nuevas. Puedes consultar el historial.{" "}
          <Link href="/dashboard/suscripcion" className="font-bold underline">Ver planes</Link>
        </p>
      )}
    </div>
  );
}
