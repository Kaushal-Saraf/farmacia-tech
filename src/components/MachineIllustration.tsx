import { QrCode, ShieldCheck, Clock } from "lucide-react";

/** Hero illustration: stylised Farmacia Tech kiosk with floating status cards. */
export function MachineIllustration() {
  const slots = Array.from({ length: 12 });
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute inset-6 -z-10 rounded-[3rem] bg-brand-300/40 blur-3xl" />

      <svg viewBox="0 0 320 420" className="w-full drop-shadow-2xl" role="img" aria-label="Farmacia Tech medicine vending machine">
        <defs>
          <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2360e2" />
            <stop offset="1" stopColor="#0d3f82" />
          </linearGradient>
          <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eef4fe" />
            <stop offset="1" stopColor="#dbe7fd" />
          </linearGradient>
        </defs>
        {/* body */}
        <rect x="30" y="10" width="260" height="400" rx="26" fill="url(#body)" />
        <rect x="44" y="24" width="232" height="36" rx="10" fill="#fff" fillOpacity=".12" />
        <path d="M60 36h8v-6h8v6h8v8h-8v6h-8v-6h-8z" fill="#fff" />
        <rect x="96" y="35" width="92" height="7" rx="3.5" fill="#fff" fillOpacity=".85" />
        <rect x="96" y="46" width="60" height="5" rx="2.5" fill="#fff" fillOpacity=".4" />

        {/* shelves window */}
        <rect x="44" y="72" width="160" height="228" rx="12" fill="url(#glass)" />
        {slots.map((_, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const x = 56 + col * 48;
          const y = 84 + row * 54;
          const tones = ["#8bb1f5", "#b9d0fa", "#5a8cee", "#ffffff"];
          return (
            <g key={i}>
              <rect x={x} y={y} width="40" height="40" rx="6" fill="#fff" stroke="#b9d0fa" />
              <rect x={x + 8} y={y + 8} width="24" height="16" rx="3" fill={tones[(i * 7) % 4]} stroke="#8bb1f5" strokeWidth=".8" />
              <rect x={x + 6} y={y + 30} width="28" height="3" rx="1.5" fill="#dbe7fd" />
            </g>
          );
        })}

        {/* control panel */}
        <rect x="214" y="72" width="62" height="96" rx="10" fill="#061b3a" fillOpacity=".55" />
        <rect x="221" y="80" width="48" height="36" rx="5" fill="#8bb1f5" fillOpacity=".9" />
        <rect x="227" y="88" width="30" height="4" rx="2" fill="#fff" />
        <rect x="227" y="96" width="20" height="4" rx="2" fill="#fff" fillOpacity=".6" />
        <rect x="224" y="126" width="42" height="32" rx="6" fill="#fff" fillOpacity=".12" stroke="#fff" strokeOpacity=".5" strokeDasharray="3 3" />
        <circle cx="245" cy="142" r="6" fill="#fff" fillOpacity=".85" />
        <rect x="214" y="178" width="62" height="60" rx="10" fill="#fff" fillOpacity=".1" />
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => (
            <circle key={`${r}${c}`} cx={229 + c * 16} cy={193 + r * 15} r="4.5" fill="#fff" fillOpacity=".55" />
          )),
        )}
        <rect x="214" y="248" width="62" height="52" rx="10" fill="#fff" fillOpacity=".1" />
        <rect x="226" y="262" width="38" height="6" rx="3" fill="#fff" fillOpacity=".5" />
        <rect x="226" y="276" width="26" height="6" rx="3" fill="#fff" fillOpacity=".3" />

        {/* pickup tray */}
        <rect x="44" y="316" width="232" height="62" rx="12" fill="#061b3a" fillOpacity=".5" />
        <rect x="64" y="332" width="192" height="30" rx="8" fill="#061b3a" fillOpacity=".6" />
        <rect x="136" y="343" width="48" height="10" rx="5" fill="#8bb1f5" />
        <rect x="60" y="392" width="200" height="6" rx="3" fill="#fff" fillOpacity=".15" />
      </svg>

      <div className="absolute -left-4 top-24 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-line sm:-left-10">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold text-ink">Prescription verified</p>
          <p className="text-[11px] text-muted">Signed by a registered doctor</p>
        </div>
      </div>

      <div className="absolute -right-2 top-1/2 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-line sm:-right-8">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white">
          <QrCode className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold text-ink">QR scanned</p>
          <p className="text-[11px] text-muted">Dispensing slot 4 & 7…</p>
        </div>
      </div>

      <div className="absolute bottom-10 -left-2 flex items-center gap-2 rounded-full bg-brand-950 px-4 py-2 text-xs font-semibold text-white shadow-card sm:-left-6">
        <Clock className="h-4 w-4 text-brand-300" /> Open 24×7
      </div>
    </div>
  );
}
