import type { Metadata } from "next";
import { FileText, History, UserCheck } from "lucide-react";
import { requireSide, requireViewer } from "@/lib/auth";
import { reviewApplication } from "./actions";
import { Card, Empty, PageTitle } from "../ui";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata: Metadata = { title: "Doctor verification" };

const auditLabel: Record<string, string> = {
  admin_verified: "Admin signed in (email + authenticator)",
  admin_unlocked: "Admin unlocked with PIN",
  admin_pin_set: "Admin PIN set",
  admin_pin_changed: "Admin PIN changed",
  admin_pin_wrong: "Wrong admin PIN",
  admin_pin_locked: "Admin locked after wrong PINs",
  doctor_approved: "Doctor approved",
  doctor_rejected: "Doctor rejected",
  device_registered: "Device registered",
  device_key_reset: "New device key",
  pairing_code_reset: "New pairing code",
};

export default async function AdminPage() {
  await requireSide("admin");
  const { supabase } = await requireViewer(["admin"]);
  const [{ data: apps }, { data: reviewed }, { data: audit }] = await Promise.all([
    supabase
      .from("doctor_applications")
      .select("id, full_name, registration_no, council, qualification, document_path, created_at")
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("doctor_applications")
      .select("id, full_name, registration_no, council, qualification, status, reviewed_at")
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(20),
    supabase.from("admin_audit").select("id, action, target, created_at").order("id", { ascending: false }).limit(20),
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
      <PageTitle title="Doctor verification" subtitle="Check each doctor's registration before they can prescribe." />

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
                <SubmitButton name="decision" value="approve" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Approve</SubmitButton>
                <SubmitButton name="decision" value="reject" className="rounded-lg px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50">Reject</SubmitButton>
              </form>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-4 mt-12 text-lg font-bold text-ink">Recently reviewed</h2>
      {!reviewed?.length ? (
        <p className="text-sm text-muted">No decisions yet.</p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr><th className="px-5 py-3">Doctor</th><th className="px-5 py-3">Registration</th><th className="px-5 py-3">Decision</th><th className="px-5 py-3">Date</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {reviewed.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 font-semibold text-ink">{r.full_name}<span className="block text-xs font-normal text-muted">{r.qualification}</span></td>
                  <td className="px-5 py-3 text-ink">{r.registration_no}<span className="block text-xs text-muted">{r.council}</span></td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${r.status === "approved" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"}`}>
                      {r.status === "approved" ? "Approved" : "Rejected"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">{r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <h2 className="mb-4 mt-12 flex items-center gap-2 text-lg font-bold text-ink"><History className="h-5 w-5 text-brand-500" /> Admin activity</h2>
      {!audit?.length ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                <span className="text-ink">
                  {auditLabel[a.action] ?? a.action}
                  {a.target && <span className="ml-1 font-mono text-xs text-muted">{a.target.length > 20 ? `${a.target.slice(0, 8)}…` : a.target}</span>}
                </span>
                <span className="text-xs text-muted">{new Date(a.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
