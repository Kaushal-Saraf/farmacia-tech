import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { Card, PageTitle } from "../../ui";
import { NewMachineForm } from "./NewMachineForm";

export const metadata: Metadata = { title: "Add machine" };

export default async function NewMachinePage() {
  await requireViewer(["admin"]);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app/vendor" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Machines
      </Link>
      <PageTitle title="Add a machine" subtitle="Creates the machine and its empty slots. Stock is filled in on the next screen." />
      <Card><NewMachineForm /></Card>
    </div>
  );
}
