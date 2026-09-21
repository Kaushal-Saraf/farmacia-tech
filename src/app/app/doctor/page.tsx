import type { Metadata } from "next";
import { BadgeCheck, Clock, FilePlus2, FileText, XCircle } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { Card, Empty, PageTitle } from "../ui";
import { ApplicationForm } from "./ApplicationForm";

export const metadata: Metadata = { title: "Doctor" };

export default async function DoctorPage() {
  const { supabase, profile } = await requireViewer(["patient", "doctor", "admin"]);

  if (profile.role === "doctor" || profile.role === "admin") {
    const { data: issued } = await supabase
      .from("prescriptions")
      .select("id, title, status, created_at, patient_name")
      .eq("doctor_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<{ id: string; title: string; status: string; created_at: string; patient_name: string | null }[]>();

    return (
      <>
        <PageTitle
          title="Prescriptions you've issued"
          subtitle="Verified prescriber"
          action={
            <span className="inline-flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
              <FilePlus2 className="h-4 w-4" /> New prescription (Phase 2)
            </span>
          }
        />
        {!issued?.length ? (
          <Empty icon={<FileText className="h-6 w-6" />} title="Nothing issued yet" body="The prescription writer arrives in Phase 2. It will look patients up by mobile number." />
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {issued.map((rx) => (
                <li key={rx.id} className="flex items-center justify-between gap-4 px-6 py-4 text-sm">
                  <div>
                    <p className="font-semibold text-ink">{rx.title}</p>
                    <p className="text-xs text-muted">{rx.patient_name ?? "Patient"} · {new Date(rx.created_at).toLocaleDateString("en-IN")}</p>
                  </div>
                  <span className="text-xs font-semibold capitalize text-brand-600">{rx.status}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </>
    );
  }

  const { data: application } = await supabase
    .from("doctor_applications")
    .select("full_name, registration_no, council, qualification, status, created_at")
    .eq("user_id", profile.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Prescribe on Farmacia Tech" subtitle="Verify your medical registration to start issuing e-prescriptions." />
      {application?.status === "pending" && (
        <Card className="mb-6 flex gap-4">
          <Clock className="h-6 w-6 shrink-0 text-brand-500" />
          <div>
            <p className="font-bold text-ink">Verification in progress</p>
            <p className="mt-1 text-sm text-muted">
              Registration {application.registration_no} ({application.council}). You can update the details below until it's reviewed.
            </p>
          </div>
        </Card>
      )}
      {application?.status === "rejected" && (
        <Card className="mb-6 flex gap-4">
          <XCircle className="h-6 w-6 shrink-0 text-red-500" />
          <div>
            <p className="font-bold text-ink">We couldn't verify these details</p>
            <p className="mt-1 text-sm text-muted">Please check your registration number and council and submit again.</p>
          </div>
        </Card>
      )}
      <Card>
        <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-brand-700">
          <BadgeCheck className="h-5 w-5" /> Doctor verification
        </div>
        <ApplicationForm defaults={application ?? { full_name: profile.full_name ?? "" }} />
      </Card>
    </div>
  );
}
