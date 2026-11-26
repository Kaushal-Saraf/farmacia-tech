import "server-only";
import { createPublicClient } from "@/lib/supabase/public";

/** JSON responses for the device API. Never cached: each device gets its own live data. */
export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** The key from the X-Device-Key header, or null. All checks against it happen in the database. */
export function deviceKey(request: Request) {
  const key = request.headers.get("x-device-key")?.trim();
  return key && key.length >= 10 && key.length <= 200 ? key : null;
}

export function deviceDb() {
  return createPublicClient();
}

export const unauthorised = () => json({ error: "Device key rejected" }, 401);
export const notConfigured = () => json({ error: "The server is not connected to its database yet" }, 503);
