import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

/** Authenticated receipt PDF (dashboard): proxies GET /sales/:id/receipt/pdf with the session cookie. */
const API_URL = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

export async function GET(request: NextRequest, { params }: RouteContext<"/api/sales/[id]/receipt-pdf">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const token = (await cookies()).get("mf_session")?.value;
  if (!token) return new Response("Unauthorized", { status: 401 });
  const res = await fetch(`${API_URL}/sales/${id}/receipt/pdf`, {
    headers: { cookie: `mf_session=${encodeURIComponent(token)}`, ...(request.headers.get("x-forwarded-for") ? { "x-forwarded-for": request.headers.get("x-forwarded-for")! } : {}) },
    cache: "no-store",
  });
  if (!res.ok) return new Response(res.status === 404 ? "Comprobante no encontrado" : "No se pudo generar el PDF", { status: res.status });
  const download = request.nextUrl.searchParams.get("download") === "1";
  const disposition = (res.headers.get("content-disposition") ?? 'inline; filename="boleta.pdf"').replace(/^inline/, download ? "attachment" : "inline");
  return new Response(res.body, {
    headers: { "content-type": "application/pdf", "content-disposition": disposition, "cache-control": "private, no-store" },
  });
}
