import "server-only";
import { cookies, headers } from "next/headers";
import { ApiError, type ApiErrorBody } from "@modaflow/ui/lib/api-error";
import { ADMIN_API_URL, ADMIN_SESSION_COOKIE } from "@/config/session";

export { ApiError };

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<{ data: T; response: Response }> {
  const { method = "GET", body, auth = true } = options;
  const [cookieStore, incoming] = await Promise.all([cookies(), headers()]);
  const reqHeaders = new Headers({ accept: "application/json" });
  if (body !== undefined) reqHeaders.set("content-type", "application/json");
  for (const name of ["x-forwarded-for", "user-agent"]) {
    const value = incoming.get(name);
    if (value) reqHeaders.set(name, value);
  }
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (auth && token) reqHeaders.set("cookie", `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`);

  let response: Response;
  try {
    response = await fetch(`${ADMIN_API_URL}${path}`, { method, headers: reqHeaders, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  } catch {
    throw new ApiError(503, { statusCode: 503, code: "API_UNAVAILABLE", message: "No pudimos conectar con el servidor. Intenta de nuevo en unos segundos." });
  }
  if (response.status === 204) return { data: undefined as T, response };
  const text = await response.text();
  const parsed = text ? parse(text) : undefined;
  if (!response.ok) {
    const errorBody = parsed && typeof parsed === "object" ? (parsed as ApiErrorBody) : { statusCode: response.status, message: "Ocurrió un error inesperado." };
    throw new ApiError(response.status, errorBody);
  }
  return { data: parsed as T, response };
}

export async function api<T>(path: string, options?: ApiOptions): Promise<T> {
  return (await apiRequest<T>(path, options)).data;
}

export async function persistSessionFromResponse(response: Response): Promise<void> {
  const header = response.headers.getSetCookie().find((c) => c.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  if (!header) return;
  const [pair, ...attributes] = header.split(";");
  const value = decodeURIComponent(pair.slice(ADMIN_SESSION_COOKIE.length + 1));
  const expiresAttr = attributes.map((a) => a.trim()).find((a) => a.toLowerCase().startsWith("expires="));
  (await cookies()).set(ADMIN_SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    path: "/",
    expires: expiresAttr ? new Date(expiresAttr.slice("expires=".length)) : undefined,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(ADMIN_SESSION_COOKIE);
}
