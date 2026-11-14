import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { Card, PageTitle } from "../../ui";
import { LinkDeviceForm } from "../LinkDeviceForm";

export const metadata: Metadata = { title: "Link a device" };

export default async function LinkDevicePage() {
  await requireViewer();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app/vendor" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> My devices
      </Link>
      <PageTitle title="Link a device" subtitle="Add a vending machine or Medicine Checker to your account." />
      <Card><LinkDeviceForm /></Card>
    </div>
  );
}
