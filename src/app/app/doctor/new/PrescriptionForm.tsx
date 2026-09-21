"use client";

import { useActionState, useEffect, useState } from "react";
import { FlaskConical, Loader2, Pill, Plus, Search, Syringe, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/Button";
import { createPrescription, findPatient, type PatientLookup, type RxItem, type RxState } from "../actions";
import { inputClass } from "../../ui";

const KINDS = [
  { kind: "medicine", label: "Medicine", icon: Pill },
  { kind: "test", label: "Test", icon: FlaskConical },
  { kind: "injection", label: "Injection", icon: Syringe },
] as const;

const small = inputClass.replace("px-4 py-3", "px-3 py-2.5");

function blank(kind: RxItem["kind"] = "medicine"): RxItem {
  return { kind, name: "", strength: "", per_day: kind === "medicine" ? "1" : "", days: kind === "medicine" ? "5" : "", instructions: "" };
}

type Patient = NonNullable<PatientLookup["patient"]>;

function PatientPicker({ onPick }: { onPick: (p: Patient) => void }) {
  const [lookup, lookupAction, looking] = useActionState<PatientLookup, FormData>(findPatient, {});
  useEffect(() => {
    if (lookup.patient) onPick(lookup.patient);
  }, [lookup.patient, onPick]);
  return (
    <>
      <form action={lookupAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-medium text-ink">
          Patient's mobile number
          <div className="mt-1.5 flex rounded-xl ring-1 ring-inset ring-line focus-within:ring-2 focus-within:ring-brand-500">
            <span className="flex items-center border-r border-line px-3 text-sm font-semibold text-muted">+91</span>
            <input name="phone" type="tel" inputMode="numeric" maxLength={10} required placeholder="98765 43210" className="w-full rounded-r-xl bg-transparent px-3 py-3 text-sm outline-none" />
          </div>
        </label>
        <Button type="submit" variant="secondary" disabled={looking}>
          {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find patient
        </Button>
      </form>
      {lookup.error && <p role="alert" className="mt-3 text-sm text-red-600">{lookup.error}</p>}
    </>
  );
}

export function PrescriptionForm() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [state, submit, saving] = useActionState<RxState, FormData>(createPrescription, {});
  const [items, setItems] = useState<RxItem[]>([blank()]);

  const update = (i: number, patch: Partial<RxItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const remove = (i: number) => setItems((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== i) : xs));

  return (
    <div className="space-y-6">
      {/* 1. Patient */}
      <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-line">
        <h2 className="flex items-center gap-2 font-bold text-ink"><UserRound className="h-5 w-5 text-brand-500" /> Patient</h2>
        {patient ? (
          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-brand-50 px-4 py-3 ring-1 ring-brand-100">
            <p className="font-semibold text-brand-900">{patient.full_name ?? "Unnamed patient"}</p>
            <button type="button" onClick={() => setPatient(null)} className="text-sm font-semibold text-brand-600 hover:underline">
              Change
            </button>
          </div>
        ) : (
          <PatientPicker onPick={setPatient} />
        )}
      </section>

      {/* 2. Prescription */}
      <form action={submit} className={`space-y-6 ${patient ? "" : "pointer-events-none opacity-50"}`}>
        <input type="hidden" name="patient_id" value={patient?.id ?? ""} />
        <input type="hidden" name="items" value={JSON.stringify(items)} />

        <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-line">
          <h2 className="font-bold text-ink">Consultation</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-ink sm:col-span-2">
              Diagnosis / title
              <input name="title" required className={inputClass} placeholder="e.g. Viral fever" />
            </label>
            <label className="text-sm font-medium text-ink sm:col-span-2">
              Notes <span className="font-normal text-muted">(optional)</span>
              <textarea name="notes" rows={2} className={inputClass} placeholder="Symptoms, findings…" />
            </label>
          </div>
          <details className="mt-4 group">
            <summary className="cursor-pointer text-sm font-semibold text-brand-600">Add vitals (optional)</summary>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["height_cm", "Height (cm)"],
                ["weight_kg", "Weight (kg)"],
                ["bp", "BP (mmHg)"],
                ["pulse", "Pulse (bpm)"],
                ["temperature_f", "Temp (°F)"],
                ["blood_group", "Blood group"],
              ].map(([n, l]) => (
                <label key={n} className="text-xs font-medium text-muted">
                  {l}
                  <input name={n} className={small} />
                </label>
              ))}
            </div>
          </details>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-line">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-ink">Medicines, tests & injections</h2>
            <div className="flex gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  onClick={() => setItems((xs) => [...xs, blank(k.kind)])}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-100 hover:bg-brand-100"
                >
                  <Plus className="h-3.5 w-3.5" /> {k.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-5 space-y-3">
            {items.map((it, i) => {
              const K = KINDS.find((k) => k.kind === it.kind)!;
              return (
                <li key={i} className="rounded-xl bg-surface p-4 ring-1 ring-line">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-600">
                      <K.icon className="h-4 w-4" /> {K.label}
                    </span>
                    <button type="button" onClick={() => remove(i)} className="rounded-lg p-1.5 text-muted hover:bg-white hover:text-red-600" aria-label="Remove item">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-6">
                    <label className="text-xs font-medium text-muted sm:col-span-3">
                      Name
                      <input value={it.name} onChange={(e) => update(i, { name: e.target.value })} className={small} placeholder={it.kind === "test" ? "e.g. CBC" : "e.g. Paracetamol"} />
                    </label>
                    {it.kind !== "test" && (
                      <label className="text-xs font-medium text-muted sm:col-span-1">
                        Strength
                        <input value={it.strength} onChange={(e) => update(i, { strength: e.target.value })} className={small} placeholder="500 mg" />
                      </label>
                    )}
                    {it.kind === "medicine" && (
                      <>
                        <label className="text-xs font-medium text-muted">
                          Times/day
                          <input type="number" min={1} max={12} value={it.per_day} onChange={(e) => update(i, { per_day: e.target.value })} className={small} />
                        </label>
                        <label className="text-xs font-medium text-muted">
                          Days
                          <input type="number" min={1} max={365} value={it.days} onChange={(e) => update(i, { days: e.target.value })} className={small} />
                        </label>
                      </>
                    )}
                    <label className="text-xs font-medium text-muted sm:col-span-6">
                      Instructions <span className="font-normal">(optional)</span>
                      <input value={it.instructions} onChange={(e) => update(i, { instructions: e.target.value })} className={small} placeholder={it.kind === "medicine" ? "After food" : ""} />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-line">
          <label className="text-sm font-medium text-ink">
            Advice <span className="font-normal text-muted">(optional)</span>
            <textarea name="advice" rows={2} className={inputClass} placeholder="Rest, fluids, follow up in 5 days…" />
          </label>
        </section>

        {state.error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !patient}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Sign & issue prescription
          </Button>
        </div>
      </form>
    </div>
  );
}
