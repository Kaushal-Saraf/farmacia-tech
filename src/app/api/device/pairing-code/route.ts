import { deviceDb, deviceKey, json, notConfigured, unauthorised } from "@/lib/device-api";
import { hashPairingCode, newPairingCode } from "@/lib/devices";
import { pairingUrl, qrRows } from "@/lib/pairing-qr";

/**
 * POST /api/device/pairing-code: the device's Pair button (modules/5-devices/device-api.md §3c).
 * Returns a pairing code plus a QR of the link that opens the website's link page with it filled in.
 * The device shows the QR (and the code as text) on its screen. Valid 10 minutes, works once; a new
 * request replaces the previous code.
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

  const result = data as { deviceId: string; expiresAt: string; linked: boolean };
  // Same address the device used, so a phone on the same network can open it (also for a laptop dev server).
  const url = pairingUrl(new URL(request.url).origin, result.deviceId, pairingCode);
  return json({ ...result, pairingCode, pairingUrl: url, qr: qrRows(url) });
}
