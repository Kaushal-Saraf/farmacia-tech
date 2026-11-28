import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSide, requireViewer } from "@/lib/auth";
import { Card, PageTitle } from "../../ui";
import { NewMachineForm } from "./NewMachineForm";

export const metadata: Metadata = { title: "Register device" };

export default async function NewMachinePage() {
  await requireSide("admin");
  await requireViewer(["admin"]);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app/vendor" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Devices
      </Link>
      <PageTitle
        title="Register a device"
        subtitle="Creates its Device ID and the key the device uses to connect. The operator links it later with the code the device shows."
      />
      <Card><NewMachineForm /></Card>
    </div>
  );
}
