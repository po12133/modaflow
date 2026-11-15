import type { NextRequest } from "next/server";

/** Public receipt PDF by capability token (shared with the customer). */
const API_URL = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

export async function GET(request: NextRequest, { params }: RouteContext<"/api/receipts/[token]/pdf">) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const res = await fetch(`${API_URL}/receipts/${token}/pdf`, {
    headers: request.headers.get("x-forwarded-for") ? { "x-forwarded-for": request.headers.get("x-forwarded-for")! } : {},
    cache: "no-store",
  });
  if (!res.ok) return new Response("Comprobante no encontrado", { status: 404 });
  const download = request.nextUrl.searchParams.get("download") === "1";
  const disposition = (res.headers.get("content-disposition") ?? 'inline; filename="boleta.pdf"').replace(/^inline/, download ? "attachment" : "inline");
  return new Response(res.body, {
    headers: { "content-type": "application/pdf", "content-disposition": disposition, "cache-control": "private, no-store", "x-robots-tag": "noindex" },
  });
}
