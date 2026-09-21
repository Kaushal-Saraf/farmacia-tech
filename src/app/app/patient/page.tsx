import type { Metadata } from "next";
import { FileText, Pill } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { Card, Empty, PageTitle } from "../ui";

export const metadata: Metadata = { title: "My prescriptions" };

type Rx = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  advice: string | null;
  doctor_name: string | null;
  items: { id: string; kind: string; name: string; strength: string | null; per_day: number | null; days: number | null }[];
};

const statusStyle: Record<string, string> = {
  issued: "bg-brand-50 text-brand-700 ring-brand-100",
  paid: "bg-sky-50 text-sky-700 ring-sky-100",
  dispensed: "bg-slate-100 text-slate-700 ring-slate-200",
  cancelled: "bg-red-50 text-red-700 ring-red-100",
};

export default async function PatientPage() {
  const { supabase, profile } = await requireViewer();
  const { data } = await supabase
    .from("prescriptions")
    .select("id, title, status, created_at, advice, doctor_name, items:prescription_items(id, kind, name, strength, per_day, days)")
    .eq("patient_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<Rx[]>();

  const prescriptions = data ?? [];

  return (
    <>
      <PageTitle title="My prescriptions" subtitle="Prescriptions issued to your mobile number by verified doctors." />
      {prescriptions.length === 0 ? (
        <Empty
          icon={<FileText className="h-6 w-6" />}
          title="No prescriptions yet"
          body={`When a doctor on Farmacia Tech prescribes to ${profile.phone ?? "your number"}, it will appear here.`}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {prescriptions.map((rx) => (
            <Card key={rx.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-ink">{rx.title}</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    Dr. {rx.doctor_name ?? "—"} ·{" "}
                    {new Date(rx.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${statusStyle[rx.status] ?? ""}`}>
                  {rx.status}
                </span>
              </div>
              <ul className="mt-4 divide-y divide-line">
                {rx.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <Pill className="h-4 w-4 text-brand-400" />
                    <span className="flex-1 font-medium text-ink">
                      {it.name} {it.strength && <span className="text-muted">{it.strength}</span>}
                    </span>
                    {it.per_day && it.days && (
                      <span className="text-xs text-muted">{it.per_day}×/day · {it.days} days</span>
                    )}
                  </li>
                ))}
              </ul>
              {rx.advice && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-muted">{rx.advice}</p>}
              {rx.status === "issued" && (
                <p className="mt-4 text-xs font-medium text-brand-600">Buying at a machine is coming soon.</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
