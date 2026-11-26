import { json } from "@/lib/device-api";
import { DEVICE_API_VERSION } from "@/lib/device-api-version";

/** GET /api/device/health — no key needed. Lets a device check its network and the server clock. */
export async function GET() {
  return json({ ok: true, api: DEVICE_API_VERSION, serverTime: new Date().toISOString().replace(/\.\d{3}Z$/, "Z") });
}
