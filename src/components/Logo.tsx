import { useId } from "react";

/** Vector version of the Farmacia Tech mark: a cross framed by the vending-machine window. */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2360e2" />
          <stop offset="1" stopColor="#0d3f82" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${id})`} />
      <rect x="11" y="11" width="42" height="42" rx="4" fill="#fff" fillOpacity=".08" stroke="#fff" strokeOpacity=".35" strokeWidth="1.2" />
      <rect x="16.5" y="44" width="31" height="4" rx="2" fill="#fff" fillOpacity=".4" />
      <path d="M25.5 18.5h13v9h9v13h-9v11.5h-13V40.5h-9v-13h9z" fill="#f5f9fd" />
      {[
        [13, 16],
        [51, 16],
        [13, 48],
        [51, 48],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" fill="#fff" />
      ))}
    </svg>
  );
}

export function Logo({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className={`text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        Farmacia<span className={light ? "text-brand-200" : "text-brand-500"}> Tech</span>
      </span>
    </span>
  );
}
