import { deviceDb, deviceKey, json, notConfigured, unauthorised } from "@/lib/device-api";
import { hashPairingCode, newPairingCode } from "@/lib/devices";

/**
 * POST /api/device/pairing-code: the device asks for a pairing code to show on its own screen
 * (modules/5-devices/device-api.md §3c). The operator types it on the website with the Device ID to link
 * the device to their account. Valid 10 minutes, works once; a new request replaces the previous code.
 */
export async function POST(request: Request) {
  const key = deviceKey(request);
  if (!key) return unauthorised();
  const db = deviceDb();
  if (!db) return notConfigured();

  const pairingCode = newPairingCode();
  const { data, error } = await db.rpc("device_set_pairing_code", { p_key: key, p_pairing_hash: hashPairingCode(pairingCode) });
  if (error) {
    console.error("[device/pairing-code]", error.message);
    return json({ error: "Server error, try again later" }, 500);
  }
  if (!data) return unauthorised();
  return json({ ...(data as object), pairingCode });
}
