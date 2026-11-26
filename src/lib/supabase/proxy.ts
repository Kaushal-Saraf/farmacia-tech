import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./config";
import { SIDE_COOKIE, SIDE_COOKIE_OPTIONS, isSide } from "../side";

/** Refreshes the Supabase session cookie and guards /app routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not put code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && pathname.startsWith("/app")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Already signed in: skip the login screens. /login/doctor etc. switch to that side.
  const door = /^\/login(?:\/(patient|doctor|vendor))?$/.exec(pathname);
  if (user && door) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return withSide(NextResponse.redirect(url), response, door[1]);
  }

  // /app?as=doctor (after sign-in through a door): remember the side, then drop the query.
  const as = request.nextUrl.searchParams.get("as");
  if (user && pathname === "/app" && isSide(as) && as !== "admin") {
    const url = request.nextUrl.clone();
    url.search = "";
    return withSide(NextResponse.redirect(url), response, as);
  }

  return response;
}

/** Carries refreshed auth cookies over to a redirect and sets the side cookie. */
function withSide(redirect: NextResponse, refreshed: NextResponse, side: string | undefined) {
  refreshed.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  if (side) redirect.cookies.set(SIDE_COOKIE, side, SIDE_COOKIE_OPTIONS);
  return redirect;
}
