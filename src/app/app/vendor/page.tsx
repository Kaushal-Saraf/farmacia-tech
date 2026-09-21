import type { Metadata } from "next";
import { AlertTriangle, MapPin, Server } from "lucide-react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/Button";
import { requireViewer } from "@/lib/auth";
import { Card, Empty, PageTitle } from "../ui";

export const metadata: Metadata = { title: "Machines" };

type Machine = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  is_active: boolean;
  slots: { slot_no: number; medicine_name: string | null; stock_packs: number; expires_on: string | null }[];
};

/** Slots expiring before this timestamp are flagged. */
function expiryCutoff(days = 30) {
  return Date.now() + days * 24 * 3600 * 1000;
}

export default async function VendorPage() {
  const { supabase, profile } = await requireViewer(["vendor", "admin"]);
  let query = supabase
    .from("machines")
    .select("id, code, name, address, is_active, slots:machine_slots(slot_no, medicine_name, stock_packs, expires_on)")
    .order("code");
  if (profile.role === "vendor") query = query.eq("owner_id", profile.id);
  const { data } = await query.returns<Machine[]>();
  const machines = data ?? [];
  const soon = expiryCutoff();

  return (
    <>
      <PageTitle
        title="Machines"
        subtitle={profile.role === "admin" ? "All machines on the network" : "Machines you operate"}
        action={profile.role === "admin" ? <ButtonLink href="/app/vendor/new"><Plus className="h-4 w-4" /> Add machine</ButtonLink> : undefined}
      />
      {machines.length === 0 ? (
        <Empty icon={<Server className="h-6 w-6" />} title="No machines yet" body="Once a machine is installed and assigned to you, its slots and stock will show up here." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {machines.map((m) => {
            const low = m.slots.filter((s) => s.medicine_name && s.stock_packs <= 2).length;
            const expiring = m.slots.filter((s) => s.expires_on && new Date(s.expires_on).getTime() < soon).length;
            return (
              <Link key={m.id} href={`/app/vendor/${m.id}`} className="block transition hover:-translate-y-0.5">
              <Card className="h-full hover:ring-brand-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-500">{m.code}</p>
                    <h2 className="mt-0.5 font-bold text-ink">{m.name}</h2>
                    {m.address && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted"><MapPin className="h-3.5 w-3.5" /> {m.address}</p>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${m.is_active ? "bg-brand-50 text-brand-700 ring-brand-100" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                    {m.is_active ? "Online" : "Inactive"}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-6 gap-1.5">
                  {m.slots.sort((a, b) => a.slot_no - b.slot_no).map((s) => (
                    <div
                      key={s.slot_no}
                      title={`${s.slot_no}: ${s.medicine_name ?? "empty"} (${s.stock_packs})`}
                      className={`rounded-md py-2 text-center text-[11px] font-semibold ${
                        !s.medicine_name ? "bg-surface text-muted" : s.stock_packs <= 2 ? "bg-amber-100 text-amber-800" : "bg-brand-100 text-brand-800"
                      }`}
                    >
                      {s.stock_packs}
                    </div>
                  ))}
                </div>
                {(low > 0 || expiring > 0) && (
                  <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                    {low > 0 && `${low} slot${low > 1 ? "s" : ""} low on stock`}
                    {low > 0 && expiring > 0 && " · "}
                    {expiring > 0 && `${expiring} expiring within 30 days`}
                  </p>
                )}
              </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
