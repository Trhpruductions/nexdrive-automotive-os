import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Optimistic auth gate: pages re-check the session against the database.
const SESSION_COOKIE = "nd_session";
const PUBLIC = ["/login", "/signup", "/suspended", "/approve", "/pricing", "/contact", "/terms", "/privacy", "/api/files", "/api/ingest", "/api/v1", "/api/health", "/brand", "/marketing", "/icon.png"];

async function userIdFromCookie(token: string | undefined) {
  if (!token || !process.env.AUTH_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/" || PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  const userId = await userIdFromCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname.startsWith("/portal") ? "?portal=1" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
