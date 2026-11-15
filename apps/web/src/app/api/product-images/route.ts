import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Upload proxy for product photos (backend-for-frontend): the browser posts
 * the file here and Next.js forwards it to the API with the HttpOnly session
 * cookie. Server Actions are not used because of their small body limit.
 */

const SESSION_COOKIE = "mf_session";
const API_URL = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const MAX_BYTES = 10 * 1024 * 1024;

function error(status: number, message: string, code = "UPLOAD_FAILED") {
  return NextResponse.json({ statusCode: status, code, message }, { status });
}

export async function POST(request: NextRequest) {
  // CSRF: Route Handlers don't get the Server Actions origin check, so do it here.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return error(403, "Origen de la solicitud no permitido.", "INVALID_ORIGIN");
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return error(401, "Inicia sesión para continuar.", "UNAUTHENTICATED");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, "No se recibió la foto.");
  }
  const file = form.get("file");
  const productId = form.get("productId");
  if (!(file instanceof File) || typeof productId !== "string") return error(400, "No se recibió la foto.");
  if (file.size > MAX_BYTES) return error(413, "La foto supera los 10 MB.", "INVALID_IMAGE");

  // productId must precede the file so the API can read it while streaming.
  const forward = new FormData();
  forward.append("productId", productId);
  forward.append("file", file, file.name || "foto.jpg");

  const headers = new Headers({ cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`, accept: "application/json" });
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/product-images`, { method: "POST", headers, body: forward, cache: "no-store" });
  } catch {
    return error(503, "No pudimos conectar con el servidor. Intenta de nuevo.", "API_UNAVAILABLE");
  }
  const body = await response.text();
  if (response.status === 413) return error(413, "La foto supera los 10 MB.", "INVALID_IMAGE");
  return new NextResponse(body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}
