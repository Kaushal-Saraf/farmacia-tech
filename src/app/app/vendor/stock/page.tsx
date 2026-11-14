import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Boxes, CheckCircle2, Plus } from "lucide-react";
import { ButtonLink } from "@/components/Button";
import { requireViewer } from "@/lib/auth";
import { deviceTypeLabel } from "@/lib/device-labels";
import { monthLabel, productLabel } from "@/lib/medicine";
import type { DeviceType, StockRow } from "@/lib/types";
import { Card, Empty, PageTitle } from "../../ui";
import { RowActions } from "./RowActions";

export const metadata: Metadata = { title: "Stock" };

type Device = { id: string; code: string; name: string; type: DeviceType };
type Movement = {
  id: number;
  change: number;
  quantity_after: number;
  reason: string;
  note: string | null;
  created_at: string;
  actor_id: string | null;
  batch: { batch_code: string; product: { name: string; strength: string | null } } | null;
};

const reasonLabel: Record<string, string> = {
  scan_restock: "Restocked by scan",
  scan_sold: "Sold (scan)",
  manual_set: "Count set",
  manual_add: "Added by hand",
  manual_sold: "Sold",
  manual_removed: "Removed",
  removed_expired: "Removed: expired",
  removed_recalled: "Removed: recalled",
  review_confirm: "Added from review",
};

function Badges({ r }: { r: StockRow }) {
  const b: { text: string; tone: "red" | "amber" | "slate" }[] = [];
  if (r.not_confirmed) b.push({ text: "Not confirmed", tone: "amber" });
  if (r.lock_reason === "recalled") b.push({ text: "Recalled · locked", tone: "red" });
  else if (r.lock_reason === "expired") b.push({ text: "Expired · locked", tone: "red" });
  else if (r.lock_reason === "not_confirmed") b.push({ text: "Locked until confirmed", tone: "slate" });
  if (!r.lock_reason && r.days_left !== null && r.days_left <= 90) b.push({ text: `Expires in ${r.days_left} days`, tone: "amber" });
  const tone = { red: "bg-red-50 text-red-700 ring-red-200", amber: "bg-amber-50 text-amber-800 ring-amber-200", slate: "bg-slate-100 text-slate-700 ring-slate-200" };
  return (
    <>
      {b.map((x) => (
        <span key={x.text} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone[x.tone]}`}>{x.text}</span>
      ))}
    </>
  );
}

export default async function StockPage({ searchParams }: PageProps<"/app/vendor/stock">) {
  const { supabase, profile } = await requireViewer(["vendor", "admin"]);
  const { device, empty, added } = await searchParams;

  const { data: deviceRows } = await supabase.from("machines").select("id, code, name, type").order("name").returns<Device[]>();
  const devices = deviceRows ?? [];
  if (devices.length === 0) {
    return (
      <>
        <PageTitle title="Stock" />
        <Empty icon={<Boxes className="h-6 w-6" />} title="No devices yet" body="Link a device first, then its stock shows up here." />
      </>
    );
  }
  const current = devices.find((d) => d.id === device) ?? devices[0];
  const showEmpty = empty === "1";

  // Row-level security limits both queries to this vendor's own rows.
  const [{ data: rows }, { data: moves }] = await Promise.all([
    supabase
      .from("stock_status")
      .select("*")
      .eq("machine_id", current.id)
      .order("product_name")
      .order("exp", { ascending: true, nullsFirst: true })
      .returns<StockRow[]>(),
    supabase
      .from("stock_movements")
      .select("id, change, quantity_after, reason, note, created_at, actor_id, batch:batches(batch_code, product:products(name, strength))")
      .eq("machine_id", current.id)
      .order("id", { ascending: false })
      .limit(15)
      .returns<Movement[]>(),
  ]);

  const all = rows ?? [];
  const visible = showEmpty ? all : all.filter((r) => r.quantity > 0);
  const groups = new Map<string, StockRow[]>();
  for (const r of visible) groups.set(r.product_id, [...(groups.get(r.product_id) ?? []), r]);

  const units = all.reduce((n, r) => n + r.quantity, 0);
  const unconfirmed = all.filter((r) => r.quantity > 0 && r.not_confirmed).length;
  const locked = all.filter((r) => r.quantity > 0 && r.lock_reason && r.lock_reason !== "not_confirmed").length;
  const unit = current.type === "vending" ? "packs" : "strips";
  const href = (q: Record<string, string>) => `/app/vendor/stock?${new URLSearchParams({ device: current.id, ...q })}`;

  return (
    <>
      <PageTitle
        title="Stock"
        subtitle={profile.role === "admin" ? "All operators' devices" : "By device and batch, earliest expiry first"}
        action={<ButtonLink href={`/app/vendor/stock/add?device=${current.id}`}><Plus className="h-4 w-4" /> Add stock by hand</ButtonLink>}
      />

      {devices.length > 1 && (
        <nav className="-mt-2 mb-6 flex flex-wrap gap-2" aria-label="Device">
          {devices.map((d) => (
            <Link
              key={d.id}
              href={`/app/vendor/stock?device=${d.id}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition ${
                d.id === current.id ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink ring-line hover:ring-brand-300"
              }`}
            >
              {d.name} <span className="font-mono text-xs opacity-75">{d.code}</span>
            </Link>
          ))}
        </nav>
      )}

      {added === "1" && (
        <p className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          <CheckCircle2 className="h-4 w-4" /> Stock added.
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [`${deviceTypeLabel[current.type]}`, current.code],
          ["Medicines", String(new Set(all.filter((r) => r.quantity > 0).map((r) => r.product_id)).size)],
          [`Total ${unit}`, String(units)],
          ["Need attention", String(unconfirmed + locked)],
        ].map(([k, v]) => (
          <Card key={k} className="p-4">
            <p className="text-xs text-muted">{k}</p>
            <p className={`mt-1 text-lg font-extrabold text-ink ${k.startsWith("Vending") || k.startsWith("Medicine Checker") ? "font-mono text-base" : ""}`}>{v}</p>
          </Card>
        ))}
      </div>

      {groups.size === 0 ? (
        <Empty
          icon={<Boxes className="h-6 w-6" />}
          title="No stock on this device"
          body="Restock scans from the device add stock automatically. You can also add a batch by hand."
        />
      ) : (
        <div className="space-y-5">
          {[...groups.values()].map((batches) => {
            const p = batches[0];
            const total = batches.reduce((n, r) => n + r.quantity, 0);
            return (
              <Card key={p.product_id} className="p-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
                  <div>
                    <h2 className="font-bold text-ink">{productLabel(p)}</h2>
                    <p className="text-xs text-muted">{[p.manufacturer, p.pack_size].filter(Boolean).join(" · ") || " "}</p>
                  </div>
                  <p className="text-sm text-muted"><span className="font-bold text-ink">{total}</span> {unit}</p>
                </div>
                <ul className="divide-y divide-line">
                  {batches.map((r) => (
                    <li key={r.id}>
                      <details className="group">
                        <summary className="grid cursor-pointer list-none grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 text-sm hover:bg-surface sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr_0.7fr_0.6fr_auto] sm:items-center">
                          <span className="col-span-2 flex flex-wrap items-center gap-1.5 sm:col-span-1">
                            <span className="font-mono font-semibold text-ink">{r.batch_code}</span>
                            <Badges r={r} />
                          </span>
                          <span className="text-muted"><span className="sm:hidden">MFD </span>{monthLabel(r.mfd)}</span>
                          <span className={r.lock_reason === "expired" ? "font-semibold text-red-700" : "text-ink"}><span className="text-muted sm:hidden">EXP </span>{monthLabel(r.exp)}</span>
                          <span className="text-ink">{r.mrp ? `₹${r.mrp}` : "—"}</span>
                          <span className="text-muted">{r.slot_no ? `Slot ${r.slot_no}` : r.shelf ? `Shelf ${r.shelf}` : "No shelf"}</span>
                          <span className="font-bold text-ink">{r.quantity}</span>
                          <span className="text-xs font-semibold text-brand-600 group-open:hidden">Edit</span>
                          <span className="hidden text-xs font-semibold text-muted group-open:inline">Close</span>
                        </summary>
                        <div className="border-t border-line bg-surface px-5 py-4">
                          <RowActions stockId={r.id} machineId={current.id} quantity={r.quantity} canSell={!r.lock_reason && r.quantity > 0} lockReason={r.lock_reason} />
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-right text-xs">
        <Link href={href(showEmpty ? {} : { empty: "1" })} className="font-semibold text-brand-600 hover:underline">
          {showEmpty ? "Hide batches with 0 left" : "Show batches with 0 left"}
        </Link>
      </p>

      <h2 className="mb-3 mt-10 text-lg font-bold text-ink">Recent changes</h2>
      {!moves?.length ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Medicine · batch</th><th className="px-4 py-3">What</th><th className="px-4 py-3 text-right">Change</th><th className="px-4 py-3 text-right">Left</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {moves.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">
                    {new Date(m.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5">
                    {m.batch ? <>{productLabel(m.batch.product)} · <span className="font-mono text-xs">{m.batch.batch_code}</span></> : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {reasonLabel[m.reason] ?? m.reason}
                    {m.actor_id ? "" : " · device"}
                    {m.note && <span className="block text-xs">{m.note}</span>}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${m.change > 0 ? "text-emerald-700" : "text-red-700"}`}>{m.change > 0 ? `+${m.change}` : m.change}</td>
                  <td className="px-4 py-2.5 text-right text-ink">{m.quantity_after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="mt-3 text-xs text-muted">
        <Link href={`/app/vendor/${current.id}`} className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline">
          Device details <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </p>
    </>
  );
}
