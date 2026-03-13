import { NextResponse, type NextRequest } from "next/server";
import {
  copyResponseCookies,
  hasSupabaseMiddlewareEnv,
  updateSession,
} from "@/lib/supabase/middleware";

const PROTECTED_PATHS = ["/settings", "/profile"];
const AUTH_ONLY_REDIRECTS = ["/auth/login"];

function matchesPath(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function getSafeNextPath(request: NextRequest) {
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  return nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/today";
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  if (!hasSupabaseMiddlewareEnv()) {
    return response;
  }

  const pathname = request.nextUrl.pathname;

  if (!user && matchesPath(pathname, PROTECTED_PATHS)) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", getSafeNextPath(request));
    const redirectResponse = NextResponse.redirect(loginUrl);
    return copyResponseCookies(response, redirectResponse);
  }

  if (user && matchesPath(pathname, AUTH_ONLY_REDIRECTS)) {
    const next = request.nextUrl.searchParams.get("next");
    const destination =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/today";
    const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
    return copyResponseCookies(response, redirectResponse);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
