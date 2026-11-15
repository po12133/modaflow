import "server-only";
import { headers } from "next/headers";

export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return (process.env.WEB_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto.split(",")[0]}://${host}`;
}
