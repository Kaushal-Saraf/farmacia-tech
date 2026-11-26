import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSide, requireViewer } from "@/lib/auth";
import type { DeviceType } from "@/lib/types";
import { Card, PageTitle } from "../../../ui";
import { AddStockForm } from "./AddStockForm";

export const metadata: Metadata = { title: "Add stock" };

export default async function AddStockPage({ searchParams }: PageProps<"/app/vendor/stock/add">) {
  const { side } = await requireSide("vendor", "admin");
  const { supabase, profile } = await requireViewer(["vendor", "admin"]);
  const { device } = await searchParams;

  const [{ data: deviceRows }, { data: products }, { data: shelfRows }] = await Promise.all([
    (side === "admin"
      ? supabase.from("machines").select("id, code, name, type, slots:machine_slots(slot_no)")
      : supabase.from("machines").select("id, code, name, type, slots:machine_slots(slot_no)").eq("owner_id", profile.id)
    )
      .order("name")
      .returns<{ id: string; code: string; name: string; type: DeviceType; slots: { slot_no: number }[] }[]>(),
    supabase.from("products").select("id, name, strength, manufacturer").order("name").order("strength").limit(5000),
    supabase.from("stock").select("shelf").not("shelf", "is", null).limit(1000),
  ]);

  const devices = (deviceRows ?? []).map((d) => ({ ...d, slots: d.slots.map((s) => s.slot_no).sort((a, b) => a - b) }));
  const shelves = [...new Set((shelfRows ?? []).map((r) => r.shelf as string))].sort();
  const initial = devices.find((d) => d.id === device)?.id ?? devices[0]?.id;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/app/vendor/stock${initial ? `?device=${initial}` : ""}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Stock
      </Link>
      <PageTitle title="Add stock by hand" subtitle="Type the batch details exactly as printed on the strip." />
      <Card>
        {initial ? (
          <AddStockForm devices={devices} products={products ?? []} shelves={shelves} initialDevice={initial} />
        ) : (
          <p className="text-sm text-muted">Link a device first.</p>
        )}
      </Card>
    </div>
  );
}
