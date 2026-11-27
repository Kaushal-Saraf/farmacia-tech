/** Formats the device software depends on (see modules/5-devices/device-api.md). */
export const BATCH_CODE = /^[A-Z0-9][A-Z0-9./-]{0,39}$/;
export const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const MRP = /^\d{1,6}\.\d{2}$/;

/** "NBT-240586" — capitals, hyphens kept, no spaces. Returns null if it can't be made valid. */
export function normaliseBatchCode(raw: string) {
  const v = raw.trim().toUpperCase();
  return BATCH_CODE.test(v) ? v : null;
}

/** "140.7" / "140" / "₹140.70" → "140.70" */
export function normaliseMrp(raw: string) {
  const n = Number(raw.replace(/[₹,\s]/g, "").replace(/^rs\.?/i, ""));
  if (!Number.isFinite(n) || n < 0 || n >= 1_000_000) return null;
  return n.toFixed(2);
}

/** "2027-04" → "Apr 2027" */
export function monthLabel(ym: string | null) {
  if (!ym || !YEAR_MONTH.test(ym)) return "—";
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export const productLabel = (p: { product_name?: string; name?: string; strength: string | null }) =>
  [p.product_name ?? p.name, p.strength].filter(Boolean).join(" ");
