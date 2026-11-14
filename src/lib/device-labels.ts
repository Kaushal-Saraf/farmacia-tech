import type { DeviceType } from "./types";

export const deviceTypeLabel: Record<DeviceType, string> = {
  vending: "Vending machine",
  checker: "Medicine Checker",
};

/** A device that has talked to the site in the last 10 minutes counts as online. */
export function lastSeen(iso: string | null, now = Date.now()) {
  if (!iso) return { online: false, label: "Never connected" };
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  const online = mins < 10;
  if (mins < 1) return { online, label: "Seen just now" };
  if (mins < 60) return { online, label: `Seen ${mins} min ago` };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { online, label: `Seen ${hours} h ago` };
  const days = Math.floor(hours / 24);
  if (days < 7) return { online, label: `Seen ${days} day${days > 1 ? "s" : ""} ago` };
  return { online, label: `Seen ${new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` };
}
