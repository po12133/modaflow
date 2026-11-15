import "server-only";
import { cookies, headers } from "next/headers";
import { ApiError, type ApiErrorBody } from "@modaflow/ui/lib/api-error";

export { ApiError };

/**
 * Server-side client for the ModaFlow API (backend-for-frontend pattern).
 * The browser only talks to Next.js; Next.js forwards the HttpOnly session
 * cookie to the API over the internal network. Never import from client code.
 */

export const SESSION_COOKIE = "mf_session";

const API_URL = (
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001"
).replace(/\/$/, "");


interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Attach the session cookie (default true). */
  auth?: boolean;
}

export interface ApiResult<T> {
  data: T;
  response: Response;
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<ApiResult<T>> {
  const { method = "GET", body, auth = true } = options;
  const [cookieStore, incoming] = await Promise.all([cookies(), headers()]);

  const reqHeaders = new Headers({ accept: "application/json" });
  if (body !== undefined) reqHeaders.set("content-type", "application/json");
  // Preserve the real client IP/agent for the API's rate limiting and session records.
  const forwardedFor = incoming.get("x-forwarded-for");
  if (forwardedFor) reqHeaders.set("x-forwarded-for", forwardedFor);
  const userAgent = incoming.get("user-agent");
  if (userAgent) reqHeaders.set("user-agent", userAgent);
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (auth && token) reqHeaders.set("cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: reqHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(503, {
      statusCode: 503,
      code: "API_UNAVAILABLE",
      message: "No pudimos conectar con el servidor. Intenta de nuevo en unos segundos.",
    });
  }

  if (response.status === 204) return { data: undefined as T, response };
  const text = await response.text();
  const parsed: unknown = text ? safeJson(text) : undefined;

  if (!response.ok) {
    const errorBody =
      parsed && typeof parsed === "object"
        ? (parsed as ApiErrorBody)
        : { statusCode: response.status, message: "Ocurrió un error inesperado." };
    throw new ApiError(response.status, errorBody);
  }
  return { data: parsed as T, response };
}

export async function api<T>(path: string, options?: ApiOptions): Promise<T> {
  return (await apiRequest<T>(path, options)).data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Copies the session cookie issued by the API (Set-Cookie) to the browser,
 * scoped to the web app's own domain.
 */
export async function persistSessionFromResponse(response: Response): Promise<void> {
  const header = response.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!header) return;
  const [pair, ...attributes] = header.split(";");
  const value = decodeURIComponent(pair.slice(SESSION_COOKIE.length + 1));
  const expiresAttr = attributes.map((a) => a.trim()).find((a) => a.toLowerCase().startsWith("expires="));
  const expires = expiresAttr ? new Date(expiresAttr.slice("expires=".length)) : undefined;

  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    path: "/",
    expires,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
