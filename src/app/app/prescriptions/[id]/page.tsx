import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, FlaskConical, Pill, Syringe } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { requireViewer } from "@/lib/auth";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Prescription" };

type Item = { id: string; kind: "medicine" | "test" | "injection"; name: string; strength: string | null; per_day: number | null; days: number | null; instructions: string | null };
type Rx = {
  id: string;
  title: string;
  notes: string | null;
  advice: string | null;
  vitals: Record<string, string>;
  status: string;
  created_at: string;
  doctor_id: string;
  doctor_name: string | null;
  patient_name: string | null;
  items: Item[];
};

const vitalLabels: Record<string, string> = {
  height_cm: "Height (cm)",
  weight_kg: "Weight (kg)",
  bp: "BP",
  pulse: "Pulse",
  temperature_f: "Temp (°F)",
  blood_group: "Blood group",
};

const icon = { medicine: Pill, test: FlaskConical, injection: Syringe };

export default async function PrescriptionPage({ params }: PageProps<"/app/prescriptions/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await requireViewer();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  // RLS only returns this row to the patient, the issuing doctor, or an admin.
  const { data: rx } = await supabase
    .from("prescriptions")
    .select("id, title, notes, advice, vitals, status, created_at, doctor_id, doctor_name, patient_name, items:prescription_items(id, kind, name, strength, per_day, days, instructions)")
    .eq("id", id)
    .maybeSingle<Rx>();
  if (!rx) notFound();

  const back = rx.doctor_id === profile.id ? "/app/doctor" : "/app/patient";
  const groups = (["medicine", "injection", "test"] as const).map((k) => ({ kind: k, items: rx.items.filter((i) => i.kind === k) })).filter((g) => g.items.length);
  const vitals = Object.entries(rx.vitals ?? {}).filter(([, v]) => v);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={back} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <PrintButton />
      </div>

      <article className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line print:shadow-none print:ring-0">
        <header className="brand-gradient flex flex-wrap items-start justify-between gap-4 px-8 py-6 text-white print:bg-none print:text-ink">
          <div className="flex items-center gap-3">
            <LogoMark className="h-10 w-10" />
            <div>
              <p className="text-lg font-extrabold">Dr. {rx.doctor_name ?? "—"}</p>
              <p className="flex items-center gap-1 text-xs text-brand-100 print:text-muted"><BadgeCheck className="h-3.5 w-3.5" /> Verified on Farmacia Tech</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{new Date(rx.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
            <p className="text-xs text-brand-100 print:text-muted">Rx #{rx.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </header>

        <div className="space-y-8 px-8 py-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Patient</p>
              <p className="mt-1 font-bold text-ink">{rx.patient_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Diagnosis</p>
              <p className="mt-1 font-bold text-ink">{rx.title}</p>
            </div>
          </div>

          {vitals.length > 0 && (
            <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-surface p-4 sm:grid-cols-3">
              {vitals.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] font-semibold text-muted">{vitalLabels[k] ?? k}</dt>
                  <dd className="text-sm font-bold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {rx.notes && <p className="text-sm leading-relaxed text-muted">{rx.notes}</p>}

          {groups.map((g) => {
            const Icon = icon[g.kind];
            return (
              <section key={g.kind}>
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-600">
                  <Icon className="h-4 w-4" /> {g.kind === "medicine" ? "Rx" : g.kind === "test" ? "Tests" : "Injections"}
                </h2>
                <ol className="mt-3 divide-y divide-line rounded-2xl ring-1 ring-line">
                  {g.items.map((it, n) => (
                    <li key={it.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-4">
                      <span className="w-5 text-sm font-bold text-muted">{n + 1}.</span>
                      <span className="flex-1 font-semibold text-ink">
                        {it.name} {it.strength && <span className="font-normal text-muted">{it.strength}</span>}
                      </span>
                      {it.per_day && it.days && <span className="text-sm text-ink">{it.per_day}× a day · {it.days} days</span>}
                      {it.instructions && <span className="w-full pl-9 text-xs text-muted">{it.instructions}</span>}
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}

          {rx.advice && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-600">Advice</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink">{rx.advice}</p>
            </section>
          )}
        </div>
        <footer className="border-t border-line px-8 py-4 text-xs text-muted">
          Issued digitally on Farmacia Tech. Status: <span className="font-semibold capitalize">{rx.status}</span>
        </footer>
      </article>
    </div>
  );
}
