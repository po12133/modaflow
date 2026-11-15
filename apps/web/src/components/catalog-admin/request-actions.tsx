"use client";

import { useState, useTransition } from "react";
import { updateRequestStatusAction } from "@/actions/catalog";
import type { RequestStatus } from "@/types/catalog";

export function RequestActions({ id, status }: { id: string; status: RequestStatus }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (next: "ATTENDED" | "CANCELED") =>
    start(async () => {
      const res = await updateRequestStatusAction(id, next);
      setError(res.ok ? null : res.message);
    });

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending || status === "ATTENDED"} onClick={() => set("ATTENDED")} className="h-11 rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-50">
          Marcar como atendida
        </button>
        <button type="button" disabled={pending || status === "CANCELED"} onClick={() => set("CANCELED")} className="h-11 rounded-xl border bg-card px-4 text-sm font-bold disabled:opacity-50">
          Cancelar solicitud
        </button>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
