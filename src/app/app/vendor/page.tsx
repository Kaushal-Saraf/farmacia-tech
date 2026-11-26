import type { Metadata } from "next";
import Link from "next/link";
import { Link2, MapPin, Plus, ScanLine, Server } from "lucide-react";
import { ButtonLink } from "@/components/Button";
import { hasRole, requireSide } from "@/lib/auth";
import { deviceTypeLabel, lastSeen } from "@/lib/device-labels";
import type { DeviceType } from "@/lib/types";
import { Card, Empty, PageTitle } from "../ui";
import { LinkDeviceForm } from "./LinkDeviceForm";

export const metadata: Metadata = { title: "Devices" };

type Device = {
  id: string;
  code: string;
  name: string;
  type: DeviceType;
  address: string | null;
  is_active: boolean;
  owner_id: string | null;
  last_seen_at: string | null;
};

export default async function DevicesPage() {
  const { supabase, profile, side } = await requireSide("vendor", "admin");
  const isAdmin = side === "admin";

  // Not an operator yet: linking their first device is what makes them one.
  if (!isAdmin && !hasRole(profile, "vendor")) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle title="Link your first device" subtitle="Add the vending machine or Medicine Checker you received from Farmacia Tech." />
        <Card><LinkDeviceForm /></Card>
      </div>
    );
  }

  // Operator side: only this number's devices (even if it is also an admin). Admin side: all.
  let query = supabase.from("machines").select("id, code, name, type, address, is_active, owner_id, last_seen_at").order("name");
  if (!isAdmin) query = query.eq("owner_id", profile.id);
  const { data } = await query.returns<Device[]>();
  const devices = data ?? [];

  // At-a-glance numbers per device (row-level security keeps these to this operator).
  const ids = devices.map((d) => d.id);
  const [{ data: stockRows }, { data: openScans }] = ids.length
    ? await Promise.all([
        supabase.from("stock_status").select("machine_id, quantity, lock_reason").in("machine_id", ids).gt("quantity", 0),
        supabase.from("scan_events").select("machine_id").in("machine_id", ids).eq("review_status", "open"),
      ])
    : [{ data: [] }, { data: [] }];
  const glance = new Map<string, { units: number; locked: number; review: number }>();
  for (const id of ids) glance.set(id, { units: 0, locked: 0, review: 0 });
  for (const r of stockRows ?? []) {
    const g = glance.get(r.machine_id as string)!;
    g.units += r.quantity as number;
    if (r.lock_reason === "expired" || r.lock_reason === "recalled") g.locked += r.quantity as number;
  }
  for (const r of openScans ?? []) glance.get(r.machine_id as string)!.review += 1;

  return (
    <>
      <PageTitle
        title={isAdmin ? "All devices" : "My devices"}
        subtitle={isAdmin ? "Every registered vending machine and Medicine Checker" : "Vending machines and Medicine Checkers linked to your account"}
        action={
          isAdmin ? (
            <ButtonLink href="/app/vendor/new"><Plus className="h-4 w-4" /> Register device</ButtonLink>
          ) : (
            <ButtonLink href="/app/vendor/link"><Link2 className="h-4 w-4" /> Link a device</ButtonLink>
          )
        }
      />
      {devices.length === 0 ? (
        <Empty
          icon={<Server className="h-6 w-6" />}
          title="No devices yet"
          body={isAdmin ? "Register a device to get its Device ID and pairing code." : "Click Link a device and enter the Device ID and pairing code from Farmacia Tech."}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {devices.map((d) => {
            const seen = lastSeen(d.last_seen_at);
            const Icon = d.type === "vending" ? Server : ScanLine;
            return (
              <Link key={d.id} href={`/app/vendor/${d.id}`} className="block transition hover:-translate-y-0.5">
                <Card className="h-full hover:ring-brand-200">
                  <div className="flex items-start gap-4">
                    <span className="brand-gradient grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-bold text-ink">{d.name}</h2>
                      <p className="text-xs text-muted">
                        {deviceTypeLabel[d.type]} · <span className="font-mono">{d.code}</span>
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{d.address ?? "Location not set"}</span>
                  </p>
                  {(() => {
                    const g = glance.get(d.id)!;
                    return (
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-surface py-2"><p className="text-sm font-bold text-ink">{g.units}</p><p className="text-[11px] text-muted">in stock</p></div>
                        <div className={`rounded-lg py-2 ${g.review ? "bg-amber-50" : "bg-surface"}`}><p className={`text-sm font-bold ${g.review ? "text-amber-800" : "text-ink"}`}>{g.review}</p><p className="text-[11px] text-muted">to review</p></div>
                        <div className={`rounded-lg py-2 ${g.locked ? "bg-red-50" : "bg-surface"}`}><p className={`text-sm font-bold ${g.locked ? "text-red-700" : "text-ink"}`}>{g.locked}</p><p className="text-[11px] text-muted">to remove</p></div>
                      </div>
                    );
                  })()}
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className={`inline-flex items-center gap-1.5 ${seen.online ? "text-emerald-700" : "text-muted"}`}>
                      <span className={`h-2 w-2 rounded-full ${seen.online ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {seen.label}
                    </span>
                    {isAdmin && !d.owner_id && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200">Not linked</span>}
                    {!d.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 ring-1 ring-slate-200">Inactive</span>}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
