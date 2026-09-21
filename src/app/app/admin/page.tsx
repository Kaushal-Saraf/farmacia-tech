import type { Metadata } from "next";
import { FileText, Inbox, Plus, UserCheck } from "lucide-react";
import { ButtonLink } from "@/components/Button";
import { requireViewer } from "@/lib/auth";
import { reviewApplication } from "../actions";
import { Card, Empty, PageTitle } from "../ui";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const { supabase } = await requireViewer(["admin"]);
  const [{ data: apps }, { data: leads }] = await Promise.all([
    supabase
      .from("doctor_applications")
      .select("id, full_name, registration_no, council, qualification, document_path, created_at")
      .eq("status", "pending")
      .order("created_at"),
    supabase.from("leads").select("id, name, email, phone, organisation, type, message, created_at").order("created_at", { ascending: false }).limit(25),
  ]);

  // Short-lived links to each applicant's private document.
  const docLinks = new Map<string, string>();
  await Promise.all(
    (apps ?? [])
      .filter((a) => a.document_path)
      .map(async (a) => {
        const { data } = await supabase.storage.from("doctor-docs").createSignedUrl(a.document_path!, 600);
        if (data?.signedUrl) docLinks.set(a.id, data.signedUrl);
      }),
  );

  return (
    <>
      <PageTitle
        title="Admin"
        subtitle="Verify doctors, manage machines and follow up on enquiries."
        action={<ButtonLink href="/app/vendor/new" variant="secondary"><Plus className="h-4 w-4" /> Add machine</ButtonLink>}
      />

      <h2 className="mb-4 text-lg font-bold text-ink">Pending doctor verifications</h2>
      {!apps?.length ? (
        <Empty icon={<UserCheck className="h-6 w-6" />} title="All caught up" body="New doctor applications will appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {apps.map((a) => (
            <Card key={a.id}>
              <p className="font-bold text-ink">{a.full_name}</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted">Reg. no.</dt><dd className="font-medium text-ink">{a.registration_no}</dd>
                <dt className="text-muted">Council</dt><dd className="text-ink">{a.council}</dd>
                <dt className="text-muted">Qualification</dt><dd className="text-ink">{a.qualification}</dd>
              </dl>
              {docLinks.get(a.id) ? (
                <a href={docLinks.get(a.id)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
                  <FileText className="h-4 w-4" /> View document
                </a>
              ) : (
                <p className="mt-3 text-xs font-medium text-amber-700">No document uploaded</p>
              )}
              <p className="mt-3 text-xs text-muted">Check the registration on the NMC Indian Medical Register before approving.</p>
              <form action={reviewApplication} className="mt-4 flex gap-2">
                <input type="hidden" name="id" value={a.id} />
                <button name="decision" value="approve" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Approve</button>
                <button name="decision" value="reject" className="rounded-lg px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50">Reject</button>
              </form>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-4 mt-12 text-lg font-bold text-ink">Latest enquiries</h2>
      {!leads?.length ? (
        <Empty icon={<Inbox className="h-6 w-6" />} title="No enquiries yet" body="Messages from the contact form land here." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr><th className="px-5 py-3">From</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Message</th><th className="px-5 py-3">Date</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leads.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-ink">{l.name}</p>
                    <a href={`mailto:${l.email}`} className="text-xs text-brand-600">{l.email}</a>
                    {l.organisation && <p className="text-xs text-muted">{l.organisation}</p>}
                  </td>
                  <td className="px-5 py-3 capitalize text-ink">{l.type}</td>
                  <td className="max-w-md px-5 py-3 text-muted">{l.message}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">{new Date(l.created_at).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
