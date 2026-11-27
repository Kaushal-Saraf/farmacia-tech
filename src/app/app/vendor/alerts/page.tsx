import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CalendarClock, PackageMinus, ShieldAlert, TrendingDown } from "lucide-react";
import { requireSide } from "@/lib/auth";
import { monthLabel, productLabel } from "@/lib/medicine";
import type { StockRow } from "@/lib/types";
import { removeLocked } from "./actions";
import { Card, PageTitle } from "../../ui";

export const metadata: Metadata = { title: "Alerts" };

type Removal = { id: number; change: number; reason: string; created_at: string; batch: { batch_code: string; product: { name: string; strength: string | null } } | null; machine: { code: string } | null };

const where = (r: StockRow) => (r.slot_no ? `Slot ${r.slot_no}` : r.shelf ? `Shelf ${r.shelf}` : "No shelf");

function Section({ icon: Icon, title, count, tone, children }: { icon: typeof BellRing; title: string; count: number; tone: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink">
        <Icon className={`h-5 w-5 ${tone}`} /> {title}
        <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted ring-1 ring-line">{count}</span>
      </h2>
      {children}
    </section>
  );
}

function Rows({ rows, extra }: { rows: StockRow[]; extra?: (r: StockRow) => React.ReactNode }) {
  if (!rows.length) return <p className="text-sm text-muted">None.</p>;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[720px] text-left text-sm">
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3"><span className="font-semibold text-ink">{productLabel(r)}</span><span className="block font-mono text-xs text-muted">{r.batch_code}</span></td>
              <td className="px-4 py-3 text-muted">EXP {monthLabel(r.exp)}{r.days_left !== null && r.days_left >= 0 && <span className="block text-xs">{r.days_left} days left</span>}</td>
              <td className="px-4 py-3 text-xs text-muted">{r.device_name}<span className="block font-mono">{r.device_code} · {where(r)}</span></td>
              <td className="px-4 py-3 text-right font-bold text-ink">{r.quantity}</td>
              {extra && <td className="px-4 py-3 text-right">{extra(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default async function AlertsPage() {
  const { supabase, profile, side } = await requireSide("vendor");
  let q = supabase.from("stock_status").select("*").order("exp", { ascending: true, nullsFirst: false });
  let mq = supabase
    .from("stock_movements")
    .select("id, change, reason, created_at, batch:batches(batch_code, product:products(name, strength)), machine:machines(code)")
    .in("reason", ["removed_expired", "removed_recalled"])
    .order("id", { ascending: false })
    .limit(20);
  if (side !== "admin") {
    q = q.eq("vendor_id", profile.id);
    mq = mq.eq("vendor_id", profile.id);
  }
  const [{ data }, { data: removals }] = await Promise.all([q.returns<StockRow[]>(), mq.returns<Removal[]>()]);
  const all = data ?? [];
  const inStock = all.filter((r) => r.quantity > 0);

  const toRemove = inStock.filter((r) => r.lock_reason === "expired" || r.lock_reason === "recalled");
  const unconfirmed = inStock.filter((r) => r.lock_reason === "not_confirmed");
  const sellable = inStock.filter((r) => !r.lock_reason && r.days_left !== null);
  const within = (lo: number, hi: number) => sellable.filter((r) => r.days_left! > lo && r.days_left! <= hi);

  // Low stock: per device and medicine, what can still be sold vs the device's alert level.
  const totals = new Map<string, { row: StockRow; left: number }>();
  for (const r of all) {
    const key = `${r.machine_id}:${r.product_id}`;
    const t = totals.get(key) ?? { row: r, left: 0 };
    if (!r.lock_reason) t.left += r.quantity;
    totals.set(key, t);
  }
  const low = [...totals.values()].filter((t) => t.left <= t.row.low_stock_at).sort((a, b) => a.left - b.left);

  return (
    <>
      <PageTitle title="Alerts" subtitle="Expired and recalled stock to remove, batches expiring soon, and medicines running low." />

      <Section icon={ShieldAlert} title="Locked: take off the shelf" count={toRemove.length} tone="text-red-600">
        <p className="-mt-1 mb-3 text-sm text-muted">Expired and recalled batches can&apos;t be sold. Remove them, then press Removed so stock and the log stay right.</p>
        <Rows
          rows={toRemove}
          extra={(r) => (
            <form action={removeLocked} className="flex items-center justify-end gap-2">
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">{r.lock_reason}</span>
              <input type="hidden" name="stock_id" value={r.id} />
              <input type="hidden" name="quantity" value={r.quantity} />
              <input type="hidden" name="reason" value={r.lock_reason ?? "expired"} />
              <button className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">Removed</button>
            </form>
          )}
        />
      </Section>

      {unconfirmed.length > 0 && (
        <Section icon={ShieldAlert} title="Locked until confirmed (vending machines)" count={unconfirmed.length} tone="text-amber-600">
          <p className="-mt-1 mb-3 text-sm text-muted">A vending machine never dispenses a not-confirmed batch. Confirm it in <Link href="/app/vendor/review" className="font-semibold text-brand-600 hover:underline">Review</Link> or add it by hand.</p>
          <Rows rows={unconfirmed} />
        </Section>
      )}

      <Section icon={CalendarClock} title="Expiring within 30 days" count={within(-1, 30).length} tone="text-red-600"><Rows rows={within(-1, 30)} /></Section>
      <Section icon={CalendarClock} title="Expiring in 31–60 days" count={within(30, 60).length} tone="text-amber-600"><Rows rows={within(30, 60)} /></Section>
      <Section icon={CalendarClock} title="Expiring in 61–90 days" count={within(60, 90).length} tone="text-amber-500"><Rows rows={within(60, 90)} /></Section>

      <Section icon={TrendingDown} title="Low stock" count={low.length} tone="text-amber-600">
        <p className="-mt-1 mb-3 text-sm text-muted">Sellable units at or below the device&apos;s alert level (set on each device&apos;s page).</p>
        {!low.length ? (
          <p className="text-sm text-muted">None.</p>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-left text-sm">
              <tbody className="divide-y divide-line">
                {low.map(({ row, left }) => (
                  <tr key={`${row.machine_id}:${row.product_id}`}>
                    <td className="px-4 py-3 font-semibold text-ink">{productLabel(row)}</td>
                    <td className="px-4 py-3 text-xs text-muted">{row.device_name}<span className="block font-mono">{row.device_code}</span></td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${left === 0 ? "text-red-700" : "text-amber-700"}`}>{left === 0 ? "Out of stock" : `${left} left`}</span>
                      <span className="block text-xs text-muted">alert at {row.low_stock_at}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Section>

      <Section icon={PackageMinus} title="Removal log" count={removals?.length ?? 0} tone="text-muted">
        {!removals?.length ? (
          <p className="text-sm text-muted">Nothing removed yet.</p>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-line text-sm">
              {removals.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="text-ink">
                    {m.batch ? productLabel(m.batch.product) : "—"} <span className="font-mono text-xs text-muted">{m.batch?.batch_code}</span>
                    <span className="ml-2 text-xs text-muted">{m.reason === "removed_recalled" ? "recalled" : "expired"} · {m.machine?.code}</span>
                  </span>
                  <span className="text-xs text-muted">
                    <span className="font-semibold text-red-700">{m.change}</span> · {new Date(m.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Section>
    </>
  );
}
