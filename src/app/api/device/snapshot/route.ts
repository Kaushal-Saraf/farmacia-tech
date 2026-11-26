import { deviceDb, deviceKey, json, notConfigured, unauthorised } from "@/lib/device-api";

/**
 * GET /api/device/snapshot — everything a device needs to work offline (docs/device-api.md §3).
 * Header: X-Device-Key. 401 for an unknown key or a deactivated device.
 */
export async function GET(request: Request) {
  const key = deviceKey(request);
  if (!key) return unauthorised();
  const db = deviceDb();
  if (!db) return notConfigured();

  const { data, error } = await db.rpc("device_snapshot", { p_key: key });
  if (error) {
    console.error("[device/snapshot]", error.message);
    return json({ error: "Server error, try again later" }, 500);
  }
  if (!data) return unauthorised();
  return json(data);
}
