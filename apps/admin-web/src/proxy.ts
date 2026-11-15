import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/config/session";

export function proxy(request: NextRequest) {
  if (!request.cookies.has(ADMIN_SESSION_COOKIE)) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|acceso|api|_next|favicon.svg).*)"],
};
