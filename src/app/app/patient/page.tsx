import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Pill, UserRound } from "lucide-react";
import { requireSide } from "@/lib/auth";
import { drName, relationLabel } from "@/lib/family";
import type { Relation } from "@/lib/types";
import { Card, Empty, PageTitle } from "../ui";

export const metadata: Metadata = { title: "My prescriptions" };

type Rx = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  advice: string | null;
  doctor_name: string | null;
  member_id: string | null;
  patient_name: string | null;
  patient_relation: Relation | null;
  items: { id: string; kind: string; name: string; strength: string | null; per_day: number | null; days: number | null }[];
};

const statusStyle: Record<string, string> = {
  issued: "bg-brand-50 text-brand-700 ring-brand-100",
  paid: "bg-sky-50 text-sky-700 ring-sky-100",
  dispensed: "bg-slate-100 text-slate-700 ring-slate-200",
  cancelled: "bg-red-50 text-red-700 ring-red-100",
};

export default async function PatientPage({ searchParams }: PageProps<"/app/patient">) {
  const { supabase, profile } = await requireSide("patient");
  const { member } = await searchParams;
  const [{ data }, { data: family }] = await Promise.all([
    supabase
      .from("prescriptions")
      .select("id, title, status, created_at, advice, doctor_name, member_id, patient_name, patient_relation, items:prescription_items(id, kind, name, strength, per_day, days)")
      .eq("patient_id", profile.id)
      .order("created_at", { ascending: false })
      .returns<Rx[]>(),
    supabase
      .from("family_members")
      .select("id, full_name, relation")
      .eq("account_id", profile.id)
      .eq("is_archived", false)
      .order("created_at")
      .returns<{ id: string; full_name: string; relation: Relation }[]>(),
  ]);

  const all = data ?? [];
  const people = (family ?? []).sort((a, b) => Number(b.relation === "self") - Number(a.relation === "self"));
  const selected = typeof member === "string" && people.some((p) => p.id === member) ? member : null;
  const prescriptions = selected ? all.filter((rx) => rx.member_id === selected) : all;
  const chip = (on: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition ${on ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink ring-line hover:ring-brand-300"}`;

  return (
    <>
      <PageTitle
        title="My prescriptions"
        subtitle="Prescriptions from verified doctors for everyone on your mobile number."
        action={<Link href="/app/patient/family" className="text-sm font-semibold text-brand-600 hover:underline">Manage family →</Link>}
      />
      {people.length > 1 && (
        <nav className="-mt-2 mb-6 flex flex-wrap gap-2" aria-label="Filter by family member">
          <Link href="/app/patient" className={chip(!selected)}>Everyone</Link>
          {people.map((p) => (
            <Link key={p.id} href={`/app/patient?member=${p.id}`} className={chip(selected === p.id)}>
              {p.relation === "self" ? `${p.full_name.split(" ")[0]} (you)` : p.full_name.split(" ")[0]}
            </Link>
          ))}
        </nav>
      )}
      {prescriptions.length === 0 ? (
        <Empty
          icon={<FileText className="h-6 w-6" />}
          title="No prescriptions yet"
          body={
            selected
              ? "No prescriptions for this person yet."
              : `When a doctor on Farmacia Tech prescribes to anyone on ${profile.phone ?? "your number"}, it will appear here.`
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {prescriptions.map((rx) => (
            <Card key={rx.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                    <UserRound className="h-3.5 w-3.5" /> For {rx.patient_name ?? "—"}
                    {rx.patient_relation && rx.patient_relation !== "self" && ` (${relationLabel[rx.patient_relation].toLowerCase()})`}
                  </p>
                  <h2 className="font-bold text-ink">{rx.title}</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    Dr. {drName(rx.doctor_name) ?? "—"} ·{" "}
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
              <div className="mt-4 flex items-center justify-between">
                <Link href={`/app/prescriptions/${rx.id}`} className="text-sm font-semibold text-brand-600 hover:underline">
                  View prescription →
                </Link>
                {rx.status === "issued" && <span className="text-xs text-muted">Buying at a machine: coming soon</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
