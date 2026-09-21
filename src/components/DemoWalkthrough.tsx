"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard, MapPin, PackageCheck, Pill, QrCode, ScanLine, Stethoscope } from "lucide-react";

const STEPS = [
  { icon: Stethoscope, title: "Doctor prescribes", body: "The doctor finds the patient by mobile number and adds medicines in a few taps." },
  { icon: CreditCard, title: "Patient pays", body: "The patient picks a nearby machine that has everything in stock and pays by UPI." },
  { icon: QrCode, title: "QR code issued", body: "A single-use code is created for that order at that machine only." },
  { icon: PackageCheck, title: "Machine dispenses", body: "The patient scans the code, and the machine verifies it and drops the packs in the tray." },
];

const DURATION = 5000;

/** Illustrative walkthrough — sample data only. */
export function DemoWalkthrough() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), DURATION);
    return () => clearTimeout(t);
  }, [active, paused]);

  return (
    <div
      className="grid items-center gap-10 lg:grid-cols-[1fr_auto]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <ol className="space-y-3" role="tablist" aria-label="How Farmacia Tech works">
        {STEPS.map((s, i) => {
          const on = i === active;
          return (
            <li key={s.title}>
              <button
                role="tab"
                aria-selected={on}
                onClick={() => setActive(i)}
                className={`relative w-full overflow-hidden rounded-2xl p-5 text-left transition-all ${
                  on ? "bg-white shadow-card ring-1 ring-brand-100" : "hover:bg-white/60"
                }`}
              >
                <div className="flex items-start gap-4">
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${
                      on ? "brand-gradient text-white" : "bg-brand-50 text-brand-500"
                    }`}
                  >
                    <s.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wider ${on ? "text-brand-500" : "text-muted"}`}>Step {i + 1}</p>
                    <p className="mt-0.5 font-bold text-ink">{s.title}</p>
                    <p className={`mt-1 text-sm leading-relaxed text-muted transition-all ${on ? "max-h-24 opacity-100" : "max-h-0 opacity-0 sm:max-h-24 sm:opacity-70"}`}>
                      {s.body}
                    </p>
                  </div>
                </div>
                {on && (
                  <span
                    key={`${active}-${paused}`}
                    className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand-500"
                    style={{ animation: paused ? "none" : `progress ${DURATION}ms linear both` }}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <Phone>
        <div key={active} className="animate-fade-up h-full">
          {active === 0 && <PrescribeScreen />}
          {active === 1 && <PayScreen />}
          {active === 2 && <QrScreen />}
          {active === 3 && <DispenseScreen />}
        </div>
      </Phone>
    </div>
  );
}

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[280px] rounded-[2.5rem] bg-brand-950 p-3 shadow-2xl shadow-brand-900/30">
      <div className="relative h-[540px] overflow-hidden rounded-[2rem] bg-surface">
        <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-brand-950" />
        <div className="h-full px-4 pb-4 pt-10">{children}</div>
      </div>
    </div>
  );
}

function ScreenTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">{kicker}</p>
      <p className="text-lg font-extrabold text-ink">{title}</p>
    </div>
  );
}

const meds = [
  { name: "Paracetamol 500 mg", dose: "3×/day · 5 days" },
  { name: "Cetirizine 10 mg", dose: "1×/day · 5 days" },
];

function PrescribeScreen() {
  return (
    <>
      <ScreenTitle kicker="Doctor portal" title="New prescription" />
      <div className="rounded-xl bg-white p-3 ring-1 ring-line">
        <p className="text-[10px] font-semibold text-muted">Patient</p>
        <p className="text-sm font-bold text-ink">Aarav S. · +91 98••• ••210</p>
      </div>
      <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-line">
        <p className="text-[10px] font-semibold text-muted">Diagnosis</p>
        <p className="text-sm font-semibold text-ink">Viral fever</p>
      </div>
      <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wider text-muted">Medicines</p>
      <ul className="space-y-2">
        {meds.map((m, i) => (
          <li key={m.name} className="animate-fade-up flex items-center gap-2 rounded-xl bg-white p-3 ring-1 ring-line" style={{ animationDelay: `${400 + i * 500}ms` }}>
            <Pill className="h-4 w-4 text-brand-500" />
            <div className="flex-1">
              <p className="text-xs font-bold text-ink">{m.name}</p>
              <p className="text-[10px] text-muted">{m.dose}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="animate-fade-up mt-5 rounded-xl bg-brand-500 py-3 text-center text-sm font-bold text-white" style={{ animationDelay: "1500ms" }}>
        Sign & send
      </div>
    </>
  );
}

function PayScreen() {
  return (
    <>
      <ScreenTitle kicker="Patient app" title="Fill prescription" />
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Nearby machines</p>
      {[
        { code: "FT-GZB-001", where: "City Hospital, OPD gate", km: "1.2 km", ok: true },
        { code: "FT-GZB-004", where: "Sector 62 Metro", km: "3.8 km", ok: false },
      ].map((m) => (
        <div key={m.code} className={`mb-2 rounded-xl p-3 ring-1 ${m.ok ? "bg-white ring-brand-500" : "bg-white/60 ring-line"}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-ink">{m.code}</p>
            <span className={`text-[10px] font-semibold ${m.ok ? "text-brand-600" : "text-muted"}`}>{m.ok ? "All in stock" : "1 item missing"}</span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-[10px] text-muted"><MapPin className="h-3 w-3" /> {m.where} · {m.km}</p>
        </div>
      ))}
      <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-line text-xs">
        {meds.map((m, i) => (
          <div key={m.name} className="flex justify-between py-1"><span className="text-ink">{m.name}</span><span className="font-semibold text-ink">₹{i ? 38 : 24}</span></div>
        ))}
        <div className="mt-1 flex justify-between border-t border-line pt-2 font-bold"><span>Total</span><span>₹62</span></div>
      </div>
      <div className="animate-fade-up mt-4 rounded-xl bg-brand-500 py-3 text-center text-sm font-bold text-white" style={{ animationDelay: "800ms" }}>
        Pay ₹62 with UPI
      </div>
    </>
  );
}

function QrScreen() {
  return (
    <div className="flex h-full flex-col items-center text-center">
      <ScreenTitle kicker="Payment successful" title="Your pickup code" />
      <div className="relative rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
        <FakeQr />
        <span className="absolute inset-x-4 top-4 h-0.5 bg-brand-400/70" style={{ animation: "scan 2s ease-in-out infinite" }} />
      </div>
      <p className="mt-4 text-sm font-bold text-ink">FT-GZB-001 only</p>
      <p className="mt-1 text-xs text-muted">City Hospital, OPD gate</p>
      <div className="mt-5 w-full space-y-2 text-left text-xs">
        {["Single use", "Valid for 24 hours", "No personal data inside"].map((t, i) => (
          <p key={t} className="animate-fade-up flex items-center gap-2 text-ink" style={{ animationDelay: `${300 + i * 250}ms` }}>
            <Check className="h-4 w-4 text-brand-500" /> {t}
          </p>
        ))}
      </div>
    </div>
  );
}

function DispenseScreen() {
  return (
    <>
      <ScreenTitle kicker="Machine FT-GZB-001" title="Dispensing" />
      <div className="flex items-center gap-3 rounded-xl bg-brand-950 p-3 text-white">
        <ScanLine className="h-6 w-6 text-brand-300" />
        <div>
          <p className="text-xs font-bold">QR verified</p>
          <p className="text-[10px] text-brand-200">Order matched · payment confirmed</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {[
          { m: meds[0].name, slot: 4 },
          { m: meds[1].name, slot: 8 },
        ].map((x, i) => (
          <li key={x.m} className="animate-fade-up flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-line" style={{ animationDelay: `${600 + i * 900}ms` }}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-600">{x.slot}</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-ink">{x.m}</p>
              <p className="text-[10px] text-muted">Picked · vision check passed</p>
            </div>
            <Check className="h-4 w-4 text-brand-500" />
          </li>
        ))}
      </ul>
      <div className="animate-fade-up mt-6 rounded-2xl bg-brand-50 p-4 text-center ring-1 ring-brand-100" style={{ animationDelay: "2400ms" }}>
        <PackageCheck className="mx-auto h-8 w-8 text-brand-500" />
        <p className="mt-2 text-sm font-bold text-ink">Please collect from the tray</p>
        <p className="text-[10px] text-muted">Take care! Follow your doctor's advice.</p>
      </div>
    </>
  );
}

/** Decorative QR-style grid (not a real code). */
function FakeQr() {
  const n = 21;
  const cells: boolean[] = [];
  let seed = 7;
  for (let i = 0; i < n * n; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    cells.push(seed / 233280 > 0.5);
  }
  const finder = (r: number, c: number) => {
    const inBox = (r0: number, c0: number) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7;
    return inBox(0, 0) || inBox(0, n - 7) || inBox(n - 7, 0);
  };
  const finderOn = (r: number, c: number) => {
    const lr = r < 7 ? r : r - (n - 7);
    const lc = c < 7 ? c : c - (n - 7);
    const edge = lr === 0 || lr === 6 || lc === 0 || lc === 6;
    const core = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
    return edge || core;
  };
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="h-40 w-40" shapeRendering="crispEdges" aria-hidden="true">
      {cells.map((on, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        const filled = finder(r, c) ? finderOn(r, c) : on;
        return filled ? <rect key={i} x={c} y={r} width="1" height="1" fill="#0d3f82" /> : null;
      })}
    </svg>
  );
}
