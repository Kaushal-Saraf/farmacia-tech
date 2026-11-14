import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import type { DeviceType } from "./types";

// No 0/O or 1/I, so codes read back correctly from a printed card.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const pick = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const prefix: Record<DeviceType, string> = { vending: "FT-VM", checker: "FT-MC" };

/** Device ID printed on the device, e.g. FT-VM-7K3Q9X (vending) or FT-MC-4HT8PW (Medicine Checker). */
export const newDeviceCode = (type: DeviceType) => `${prefix[type]}-${pick(6)}`;

/** One-time code handed to the operator with the device, e.g. K7QM-3XHP. */
export const newPairingCode = () => {
  const c = pick(8);
  return `${c.slice(0, 4)}-${c.slice(4)}`;
};

/** Secret loaded into the device itself; sent in the X-Device-Key header. */
export const newDeviceKey = () => `ftk_${randomBytes(24).toString("base64url")}`;

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Must match public.hash_pairing_code() in vendor-functions.sql. */
export const hashPairingCode = (code: string) => sha256(code.replace(/[^A-Za-z0-9]/g, "").toUpperCase());

export const hashDeviceKey = (key: string) => sha256(key);
