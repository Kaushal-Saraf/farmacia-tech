import { deviceDb, deviceKey, json, notConfigured, unauthorised } from "@/lib/device-api";

/**
 * GET /api/device/ping — small heartbeat, every `pollSeconds` (modules/5-devices/device-api.md §3a).
 * Returns the server time and `snapshotVersion`; download the full snapshot only when it changes.
 */
export async function GET(request: Request) {
  const key = deviceKey(request);
  if (!key) return unauthorised();
  const db = deviceDb();
  if (!db) return notConfigured();
  const { data, error } = await db.rpc("device_ping", { p_key: key });
  if (error) {
    console.error("[device/ping]", error.message);
    return json({ error: "Server error, try again later" }, 500);
  }
  if (!data) return unauthorised();
  return json(data);
}
