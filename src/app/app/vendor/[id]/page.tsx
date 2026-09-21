import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { setMachineActive } from "../actions";
import { Card, PageTitle } from "../../ui";
import { OwnerForm } from "./OwnerForm";
import { SlotSheet, type Slot } from "./SlotSheet";

export const metadata: Metadata = { title: "Machine" };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function MachinePage({ params }: PageProps<"/app/vendor/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await requireViewer(["vendor", "admin"]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const { data: m } = await supabase
    .from("machines")
    .select("id, code, name, address, latitude, longitude, is_active, owner_id, slots:machine_slots(id, slot_no, medicine_name, strength, units_per_pack, price_paise, stock_packs, reserved_packs, batch_no, expires_on)")
    .eq("id", id)
    .maybeSingle();
  if (!m || (profile.role === "vendor" && m.owner_id !== profile.id)) notFound();

  const slots = [...(m.slots as Slot[])].sort((a, b) => a.slot_no - b.slot_no);
  const isAdmin = profile.role === "admin";
  const stocked = slots.filter((s) => s.medicine_name).length;
  const packs = slots.reduce((n, s) => n + (s.medicine_name ? s.stock_packs : 0), 0);

  return (
    <>
      <Link href="/app/vendor" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Machines
      </Link>
      <PageTitle
        title={m.name}
        subtitle={`${m.code} · ${stocked}/${slots.length} slots stocked · ${packs} packs`}
        action={
          isAdmin ? (
            <form action={setMachineActive}>
              <input type="hidden" name="machine_id" value={m.id} />
              <input type="hidden" name="active" value={String(!m.is_active)} />
              <button className={`rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ring-inset ${m.is_active ? "text-red-600 ring-red-200 hover:bg-red-50" : "bg-brand-500 text-white ring-brand-500 hover:bg-brand-600"}`}>
                {m.is_active ? "Deactivate" : "Activate"}
              </button>
            </form>
          ) : (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${m.is_active ? "bg-brand-50 text-brand-700 ring-brand-100" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
              {m.is_active ? "Active" : "Inactive"}
            </span>
          )
        }
      />
      {m.address && (
        <p className="-mt-5 mb-8 flex items-center gap-1.5 text-sm text-muted"><MapPin className="h-4 w-4" /> {m.address}</p>
      )}

      <h2 className="mb-3 text-lg font-bold text-ink">Stock sheet</h2>
      <SlotSheet machineId={m.id} slots={slots} today={todayIso()} />

      {isAdmin && (
        <Card className="mt-10 max-w-2xl">
          <h2 className="font-bold text-ink">Operator</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            {m.owner_id ? "An operator is assigned. Assigning a new number replaces them." : "No operator yet. The person must sign in once before you can assign them."}
          </p>
          <OwnerForm machineId={m.id} />
        </Card>
      )}
    </>
  );
}
