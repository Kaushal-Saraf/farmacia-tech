import "server-only";
import QRCode from "qrcode";

/**
 * The link the operator's phone opens when it scans the device's screen: <site>/L/<Device ID>/<code>.
 * All capitals on purpose: a QR stores capitals, digits and ":/.-" more compactly, so the code stays
 * 29×29 squares, which fits a 128×64 OLED at 2 pixels per square. Hosts are case-insensitive, and the
 * /L route (src/app/L) accepts it.
 */
export function pairingUrl(origin: string, deviceId: string, pairingCode: string) {
  return `${origin.replace(/\/$/, "")}/L/${deviceId}/${pairingCode.replace(/[^A-Za-z0-9]/g, "")}`.toUpperCase();
}

/**
 * The QR as rows of "1" (dark square) and "0" (light square), top to bottom. No quiet zone: the device
 * draws a light border itself. 29×29 (version 3) whenever the text fits, with the strongest error
 * correction that still fits; bigger only for an unusually long site address.
 */
export function qrRows(text: string): string[] {
  let qr: QRCode.QRCode | undefined;
  for (const level of ["M", "L"] as const) {
    try {
      qr = QRCode.create(text, { errorCorrectionLevel: level, version: 3 });
      break;
    } catch {
      // doesn't fit version 3 at this level: try the next one
    }
  }
  qr ??= QRCode.create(text, { errorCorrectionLevel: "L" });
  const { size, data } = qr.modules;
  return Array.from({ length: size }, (_, y) =>
    Array.from(data.subarray(y * size, (y + 1) * size), (dark) => (dark ? "1" : "0")).join(""),
  );
}
