import "server-only";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const MAX_BYTES = 10 * 1024 * 1024;

export interface UploadTarget {
  apiUrl: string;
  cookie: string;
  path: string;
  maxBytes?: number;
  missingMessage?: string;
  tooLargeMessage?: string;
  fileName?: string;
}

function error(status: number, message: string, code = "UPLOAD_FAILED") {
  return NextResponse.json({ statusCode: status, code, message }, { status });
}

export async function forwardImageUpload(request: NextRequest, target: UploadTarget): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return error(403, "Origen de la solicitud no permitido.", "INVALID_ORIGIN");
  const token = (await cookies()).get(target.cookie)?.value;
  if (!token) return error(401, "Inicia sesión para continuar.", "UNAUTHENTICATED");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, target.missingMessage ?? "No se recibió la imagen.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return error(400, target.missingMessage ?? "No se recibió la imagen.");
  if (file.size > (target.maxBytes ?? MAX_BYTES)) return error(413, target.tooLargeMessage ?? "La imagen supera los 10 MB.", "INVALID_IMAGE");

  const forward = new FormData();
  forward.append("file", file, file.name || target.fileName || "imagen.jpg");
  const headers = new Headers({ cookie: `${target.cookie}=${encodeURIComponent(token)}`, accept: "application/json" });
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  let response: Response;
  try {
    response = await fetch(`${target.apiUrl}${target.path}`, { method: "POST", headers, body: forward, cache: "no-store" });
  } catch {
    return error(503, "No pudimos conectar con el servidor. Intenta de nuevo.", "API_UNAVAILABLE");
  }
  return new NextResponse(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
}
