import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route protection: without a session cookie, private routes
 * redirect to /login before rendering. The real check (session validity,
 * tenant membership) happens on the API for every data request.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("mf_session")) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding"],
};
