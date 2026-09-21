import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only auth-related routes need the session — marketing pages stay fully static.
  matcher: ["/app/:path*", "/login"],
};
