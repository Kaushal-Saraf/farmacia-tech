import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { requireSide, requireViewer } from "@/lib/auth";
import { Card, Empty, PageTitle } from "../../ui";

export const metadata: Metadata = { title: "Enquiries" };

type Lead = { id: string; name: string; email: string; phone: string | null; organisation: string | null; type: string; message: string; created_at: string };

const types: { value: string; label: string }[] = [
  { value: "partner", label: "Pharmacy / hospital" },
  { value: "doctor", label: "Doctor" },
  { value: "investor", label: "Investor" },
  { value: "patient", label: "Patient" },
  { value: "other", label: "Other" },
];
const typeLabel = Object.fromEntries(types.map((t) => [t.value, t.label]));

/** Messages from the website's contact form, newest first. */
export default async function EnquiriesPage({ searchParams }: PageProps<"/app/admin/enquiries">) {
  await requireSide("admin");
  const { supabase } = await requireViewer(["admin"]);
  const { type } = await searchParams;
  const filter = typeof type === "string" && type in typeLabel ? type : "";

  let q = supabase.from("leads").select("id, name, email, phone, organisation, type, message, created_at").order("created_at", { ascending: false }).limit(200);
  if (filter) q = q.eq("type", filter);
  const { data } = await q.returns<Lead[]>();
  const leads = data ?? [];
  const chip = (on: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ${on ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink ring-line hover:ring-brand-300"}`;

  return (
    <>
      <PageTitle title="Enquiries" subtitle="Messages sent through the Contact page, newest first." />
      <nav className="-mt-2 mb-6 flex flex-wrap gap-2" aria-label="Filter by type">
        <Link href="/app/admin/enquiries" className={chip(!filter)}>All</Link>
        {types.map((t) => (
          <Link key={t.value} href={`/app/admin/enquiries?type=${t.value}`} className={chip(filter === t.value)}>{t.label}</Link>
        ))}
      </nav>
      {leads.length === 0 ? (
        <Empty icon={<Inbox className="h-6 w-6" />} title="No enquiries" body={filter ? "None of this type yet." : "Messages from the contact form land here."} />
      ) : (
        <div className="space-y-3">
          {leads.map((l) => (
            <Card key={l.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-ink">
                    {l.name}
                    {l.organisation && <span className="font-normal text-muted"> · {l.organisation}</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <a href={`mailto:${l.email}`} className="text-brand-600 hover:underline">{l.email}</a>
                    {l.phone && <a href={`tel:${l.phone}`} className="text-brand-600 hover:underline">{l.phone}</a>}
                  </p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink ring-1 ring-line">{typeLabel[l.type] ?? l.type}</span>
                  <p className="mt-1.5 text-xs text-muted">
                    {new Date(l.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">{l.message}</p>
            </Card>
          ))}
        </div>
      )}
      {leads.length === 200 && <p className="mt-3 text-xs text-muted">Showing the latest 200.</p>}
    </>
  );
}
