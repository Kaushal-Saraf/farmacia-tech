import Link from "next/link";

/** Chips to switch device, shared by the stock-style pages. */
export function DevicePicker({ devices, current, base }: { devices: { id: string; code: string; name: string }[]; current: string; base: string }) {
  if (devices.length < 2) return null;
  return (
    <nav className="-mt-2 mb-6 flex flex-wrap gap-2" aria-label="Device">
      {devices.map((d) => (
        <Link
          key={d.id}
          href={`${base}?device=${d.id}`}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition ${
            d.id === current ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink ring-line hover:ring-brand-300"
          }`}
        >
          {d.name} <span className="font-mono text-xs opacity-75">{d.code}</span>
        </Link>
      ))}
    </nav>
  );
}
