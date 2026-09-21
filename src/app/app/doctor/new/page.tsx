import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageTitle } from "../../ui";
import { PrescriptionForm } from "./PrescriptionForm";

export const metadata: Metadata = { title: "New prescription" };

export default async function NewPrescriptionPage() {
  await requireViewer(["doctor"]);
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/doctor" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <PageTitle title="New prescription" subtitle="The patient sees it in their account as soon as you issue it." />
      <PrescriptionForm />
    </div>
  );
}
