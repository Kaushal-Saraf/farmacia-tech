import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ScanLine, Server, Wifi, WifiOff } from "lucide-react";
import { requireSide } from "@/lib/auth";
import { deviceTypeLabel, lastSeen } from "@/lib/device-labels";
import type { DeviceType } from "@/lib/types";
import { setMachineActive } from "../actions";
import { Card, PageTitle } from "../../ui";
import { DeviceForm } from "./DeviceForm";
import { SecretsPanel } from "./SecretsPanel";

export const metadata: Metadata = { title: "Device" };

type Device = {
  id: string;
  code: string;
  name: string;
  type: DeviceType;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  owner_id: string | null;
  linked_at: string | null;
  last_seen_at: string | null;
  low_stock_at: number;
  slots: { count: number }[];
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function DevicePage({ params }: PageProps<"/app/vendor/[id]">) {
  const { id } = await params;
  const { supabase, profile, side } = await requireSide("vendor", "admin");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  // Row-level security already limits this to the owner or an admin.
  const { data: d } = await supabase
    .from("machines")
    .select("id, code, name, type, address, latitude, longitude, is_active, owner_id, linked_at, last_seen_at, low_stock_at, slots:machine_slots(count)")
    .eq("id", id)
    .maybeSingle<Device>();
  const isAdmin = side === "admin";
  if (!d || (!isAdmin && d.owner_id !== profile.id)) notFound();
  const seen = lastSeen(d.last_seen_at);
  const Icon = d.type === "vending" ? Server : ScanLine;
  const slotCount = d.slots[0]?.count ?? 0;

  let owner: { full_name: string | null; phone: string | null } | null = null;
  if (isAdmin && d.owner_id) {
    const { data } = await supabase.from("profiles").select("full_name, phone").eq("id", d.owner_id).maybeSingle();
    owner = data;
  }

  const facts: [string, string][] = [
    ["Device ID", d.code],
    ["Type", deviceTypeLabel[d.type]],
    ...(d.type === "vending" ? [["Slots", String(slotCount)] as [string, string]] : []),
    ["Linked", d.linked_at ? fmtDate(d.linked_at) : "Not linked yet"],
    ["Status", d.is_active ? "Active" : "Inactive"],
  ];

  return (
    <>
      <Link href="/app/vendor" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {isAdmin ? "Devices" : "My devices"}
      </Link>
      <PageTitle
        title={d.name}
        subtitle={`${deviceTypeLabel[d.type]} · ${d.code}`}
        action={
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
              seen.online ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"
            }`}
          >
            {seen.online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />} {seen.online ? "Online" : "Offline"} · {seen.label}
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card className="h-fit">
          <span className="brand-gradient grid h-12 w-12 place-items-center rounded-xl text-white">
            <Icon className="h-6 w-6" />
          </span>
          <dl className="mt-5 space-y-3 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted">{k}</dt>
                <dd className={`text-right font-semibold text-ink ${k === "Device ID" ? "font-mono" : ""}`}>{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-ink">Name & location</h2>
            <Link href={`/app/vendor/stock?device=${d.id}`} className="text-sm font-semibold text-brand-600 hover:underline">View stock →</Link>
          </div>
          <DeviceForm device={d} unit={d.type === "vending" ? "packs" : "strips"} />
        </Card>
      </div>

      {isAdmin && (
        <Card className="mt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-ink">Farmacia Tech only</h2>
              <p className="mt-1 text-sm text-muted">
                {owner
                  ? `Linked to ${owner.full_name ?? "an operator"} (${owner.phone ?? "no phone"}).`
                  : "Not linked to an operator yet. They link it with the Device ID and pairing code."}
              </p>
            </div>
            <form action={setMachineActive}>
              <input type="hidden" name="machine_id" value={d.id} />
              <input type="hidden" name="active" value={String(!d.is_active)} />
              <button
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ring-inset ${
                  d.is_active ? "text-red-600 ring-red-200 hover:bg-red-50" : "bg-brand-500 text-white ring-brand-500 hover:bg-brand-600"
                }`}
              >
                {d.is_active ? "Deactivate" : "Activate"}
              </button>
            </form>
          </div>
          <div className="mt-5">
            <SecretsPanel machineId={d.id} linked={Boolean(d.owner_id)} />
          </div>
        </Card>
      )}
    </>
  );
}
