import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/$/, "");
  return trimmed || "/";
}

export function middleware(request: NextRequest) {
  const pathname = normalizePath(request.nextUrl.pathname);
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const hasValidSession = token ? verifySessionToken(token) !== null : false;

  const isLoginPage = pathname === "/admin/login";
  const isAdminPanel =
    pathname === "/admin" ||
    (pathname.startsWith("/admin/") && !isLoginPage);

  if (isAdminPanel && !hasValidSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPage && hasValidSession) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/admin";
    dashUrl.search = "";
    return NextResponse.redirect(dashUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
