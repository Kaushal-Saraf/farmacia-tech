import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // A device's pairing QR opens /L/... (module 5). Some scanner apps lower-case links: send /l/... there too.
  const { pathname } = request.nextUrl;
  if (/^\/l\//i.test(pathname)) {
    return pathname.startsWith("/l/") ? NextResponse.redirect(new URL(`/L/${pathname.slice(3)}`, request.url), 308) : NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  // Only auth-related routes need the session — marketing pages stay fully static.
  matcher: ["/app/:path*", "/login/:path*", "/l/:path*", "/L/:path*"],
};
