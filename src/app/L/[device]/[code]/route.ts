import { NextResponse, type NextRequest } from "next/server";
import { SIDE_COOKIE, SIDE_COOKIE_OPTIONS } from "@/lib/side";

/**
 * GET /L/<Device ID>/<pairing code>: where the QR on a device's screen points (module 5).
 * It only opens the operator's "Link a device" page with both filled in; linking still needs the
 * operator to sign in and press Link device, so a link preview or a stray scan changes nothing.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/L/[device]/[code]">) {
  const { device, code } = await ctx.params;
  const url = new URL("/app/vendor/link", request.url);
  const d = device.toUpperCase();
  const c = code.toUpperCase();
  if (/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(d) && /^[A-Z0-9]{8}$/.test(c)) {
    url.searchParams.set("device", d);
    url.searchParams.set("code", `${c.slice(0, 4)}-${c.slice(4)}`);
  }
  const res = NextResponse.redirect(url, 303);
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(SIDE_COOKIE, "vendor", SIDE_COOKIE_OPTIONS); // open the operator side of the portal
  return res;
}
