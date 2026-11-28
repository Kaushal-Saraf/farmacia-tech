import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, QrCode } from "lucide-react";
import { requireSide } from "@/lib/auth";
import { Card, PageTitle } from "../../ui";
import { LinkDeviceForm } from "../LinkDeviceForm";

export const metadata: Metadata = { title: "Link a device" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function LinkDevicePage({ searchParams }: PageProps<"/app/vendor/link">) {
  await requireSide("vendor");
  // Filled in when the operator scanned the QR on the device's screen (see src/app/L).
  const q = await searchParams;
  const device = first(q.device).slice(0, 20);
  const code = first(q.code).slice(0, 12);
  const scanned = Boolean(device && code);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app/vendor" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> My devices
      </Link>
      <PageTitle title="Link a device" subtitle="Add a vending machine or Medicine Checker to your account." />
      {scanned && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-800 ring-1 ring-brand-200">
          <QrCode className="mt-0.5 h-4 w-4 shrink-0" />
          Scanned from the device. Check the Device ID matches the one on its screen, then press Link device.
        </p>
      )}
      <Card><LinkDeviceForm device={device} code={code} /></Card>
    </div>
  );
}
