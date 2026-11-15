import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const API_URL = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const FORWARDED = ["report", "period", "from", "to", "paymentMethod", "sellerId", "status", "categoryId", "productId", "search", "sort", "lowStock", "includeUnique"];

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format");
  if (format !== "xlsx" && format !== "pdf") return new Response("Formato no válido", { status: 400 });
  const token = (await cookies()).get("mf_session")?.value;
  if (!token) return new Response("Inicia sesión para descargar el reporte.", { status: 401 });

  const qs = new URLSearchParams();
  for (const key of FORWARDED) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) qs.set(key, value);
  }
  const forwardedFor = request.headers.get("x-forwarded-for");
  const res = await fetch(`${API_URL}/reports/export/${format === "xlsx" ? "excel" : "pdf"}?${qs}`, {
    headers: { cookie: `mf_session=${encodeURIComponent(token)}`, ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}) },
    cache: "no-store",
  });
  if (!res.ok || !res.body) {
    let message = "No se pudo generar el reporte.";
    try {
      message = ((await res.json()) as { message?: string }).message ?? message;
    } catch {
      /* not JSON */
    }
    return new Response(message, { status: res.status || 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": res.headers.get("content-disposition") ?? "attachment",
      "cache-control": "private, no-store",
    },
  });
}
