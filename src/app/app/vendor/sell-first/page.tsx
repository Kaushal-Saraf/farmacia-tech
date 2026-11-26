import type { Metadata } from "next";
import { ArrowDownWideNarrow, Boxes } from "lucide-react";
import { requireSide } from "@/lib/auth";
import { monthLabel, productLabel } from "@/lib/medicine";
import type { StockRow } from "@/lib/types";
import { DevicePicker } from "../DevicePicker";
import { Card, Empty, PageTitle } from "../../ui";

export const metadata: Metadata = { title: "Sell first" };

const where = (r: StockRow) => (r.slot_no ? `Slot ${r.slot_no}` : r.shelf ? `Shelf ${r.shelf}` : "No shelf set");

/** For each medicine, the batch to sell first: earliest expiry first (FEFO). */
export default async function SellFirstPage({ searchParams }: PageProps<"/app/vendor/sell-first">) {
  const { supabase, profile, side } = await requireSide("vendor", "admin");
  const { device } = await searchParams;
  let dq = supabase.from("machines").select("id, code, name").order("name");
  if (side !== "admin") dq = dq.eq("owner_id", profile.id);
  const { data: devices } = await dq;
  if (!devices?.length) return <><PageTitle title="Sell first" /><Empty icon={<Boxes className="h-6 w-6" />} title="No devices yet" body="Link a device first." /></>;
  const current = devices.find((d) => d.id === device) ?? devices[0];

  const { data } = await supabase
    .from("stock_status")
    .select("*")
    .eq("machine_id", current.id)
    .gt("quantity", 0)
    .order("product_name")
    .order("exp", { ascending: true, nullsFirst: false })
    .returns<StockRow[]>();
  const groups = new Map<string, StockRow[]>();
  for (const r of data ?? []) groups.set(r.product_id, [...(groups.get(r.product_id) ?? []), r]);

  return (
    <>
      <PageTitle title="Sell first" subtitle="For each medicine, hand out the batch that expires first. Locked batches are never sold." />
      <DevicePicker devices={devices} current={current.id} base="/app/vendor/sell-first" />
      {groups.size === 0 ? (
        <Empty icon={<ArrowDownWideNarrow className="h-6 w-6" />} title="No stock on this device" body="Once there is stock, the batch to sell first shows here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {[...groups.values()].map((rows) => {
            const sellable = rows.filter((r) => !r.lock_reason);
            const locked = rows.filter((r) => r.lock_reason);
            const first = sellable[0];
            return (
              <Card key={rows[0].product_id}>
                <h2 className="font-bold text-ink">{productLabel(rows[0])}</h2>
                {first ? (
                  <div className="mt-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Sell first</p>
                    <p className="mt-1 font-mono text-lg font-bold text-ink">{first.batch_code}</p>
                    <p className="text-sm text-emerald-900">
                      EXP {monthLabel(first.exp)}{first.days_left !== null && ` · ${first.days_left} days left`} · {where(first)} · {first.quantity} left
                      {first.not_confirmed && " · not confirmed"}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200">Nothing sellable: every batch is locked.</p>
                )}
                {sellable.length > 1 && (
                  <ol className="mt-3 space-y-1 text-sm">
                    {sellable.slice(1).map((r, i) => (
                      <li key={r.id} className="flex justify-between gap-3 text-muted">
                        <span><span className="font-semibold text-ink">{i + 2}.</span> <span className="font-mono text-ink">{r.batch_code}</span> · EXP {monthLabel(r.exp)}</span>
                        <span>{where(r)} · {r.quantity}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {locked.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                    {locked.map((r) => (
                      <li key={r.id} className="flex justify-between gap-3 text-red-700">
                        <span>Do not sell <span className="font-mono">{r.batch_code}</span> ({r.lock_reason?.replace("_", " ")})</span>
                        <span>{r.quantity}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
