import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./config";
import { SIDE_COOKIE, SIDE_COOKIE_OPTIONS, isSide, sideHome, type Side } from "../side";
import type { Role } from "../types";

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
  // /login/admin is left alone: admin is a separate email account, so a signed-in phone user may still open it.
  const door = /^\/login(?:\/(patient|doctor|vendor))?$/.exec(pathname);
  // /app itself only forwards to a side's home. Doing that here (not in the page) means the
  // page never renders just to redirect, which also avoids a React dev-mode timing error.
  const as = request.nextUrl.searchParams.get("as");
  if (user && (door || pathname === "/app")) {
    const chosen = door ? door[1] : isSide(as) && as !== "admin" ? as : undefined;
    const home = await portalHome(supabase, user.id, chosen ?? request.cookies.get(SIDE_COOKIE)?.value);
    if (home) {
      const url = request.nextUrl.clone();
      url.pathname = home;
      url.search = "";
      return withSide(NextResponse.redirect(url), response, chosen);
    }
  }

  return response;
}

/** The home page for this user's side, or the name step for a new patient. Null if unknown. */
async function portalHome(supabase: SupabaseClient, userId: string, side: string | undefined) {
  type Row = { role: Role; roles?: Role[]; full_name: string | null };
  let { data, error } = await supabase.from("profiles").select("role, roles, full_name").eq("id", userId).maybeSingle<Row>();
  if (error?.code === "42703") ({ data, error } = await supabase.from("profiles").select("role, full_name").eq("id", userId).maybeSingle<Row>());
  if (error || !data) return null;
  const roles = data.roles ?? ["patient", data.role];
  const current: Side = isSide(side) && (side !== "admin" || roles.includes("admin")) ? side : data.role;
  if (current === "patient" && !data.full_name) return "/app/welcome";
  return sideHome[current];
}

/** Carries refreshed auth cookies over to a redirect and sets the side cookie. */
function withSide(redirect: NextResponse, refreshed: NextResponse, side: string | undefined) {
  refreshed.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  if (side) redirect.cookies.set(SIDE_COOKIE, side, SIDE_COOKIE_OPTIONS);
  return redirect;
}
