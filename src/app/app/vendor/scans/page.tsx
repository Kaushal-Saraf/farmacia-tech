import type { Metadata } from "next";
import Link from "next/link";
import { ScanLine } from "lucide-react";
import { requireSide } from "@/lib/auth";
import { productLabel } from "@/lib/medicine";
import type { ReviewStatus, ScanDecision } from "@/lib/types";
import { Decision, fmtTime, type ScanFields } from "../scan-ui";
import { Card, Empty, PageTitle, inputClass } from "../../ui";

export const metadata: Metadata = { title: "Scan log" };

type Scan = {
  id: string;
  mode: "restock" | "check";
  scanned_at: string;
  product_name: string | null;
  fields: ScanFields;
  decision: ScanDecision;
  applied_decision: ScanDecision | null;
  reason: string | null;
  outcome: string | null;
  quantity: number;
  sold: boolean;
  review_status: ReviewStatus;
  device: { code: string; name: string } | null;
  product: { name: string; strength: string | null } | null;
};

const LIMIT = 200;
const reviewLabel: Partial<Record<ReviewStatus, string>> = { open: "In review", confirmed: "Confirmed", corrected: "Corrected", deleted: "Deleted" };
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function ScanLogPage({ searchParams }: PageProps<"/app/vendor/scans">) {
  const { supabase, profile, side } = await requireSide("vendor", "admin");
  const sp = await searchParams;
  const view = one(sp.view) === "reject" ? "reject" : "all";
  const device = one(sp.device);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.from)) ? one(sp.from) : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.to)) ? one(sp.to) : "";
  const result = ["ACCEPT", "REVIEW", "REFUSE"].includes(one(sp.result)) ? (one(sp.result) as ScanDecision) : "";

  let devicesQuery = supabase.from("machines").select("id, code, name").order("name");
  if (side !== "admin") devicesQuery = devicesQuery.eq("owner_id", profile.id);

  let q = supabase
    .from("scan_events")
    .select("id, mode, scanned_at, product_name, fields, decision, applied_decision, reason, outcome, quantity, sold, review_status, device:machines(code, name), product:products(name, strength)")
    .order("scanned_at", { ascending: false })
    .limit(LIMIT);
  if (side !== "admin") q = q.eq("vendor_id", profile.id);
  if (/^[0-9a-f-]{36}$/.test(device)) q = q.eq("machine_id", device);
  // Dates are India time.
  if (from) q = q.gte("scanned_at", `${from}T00:00:00+05:30`);
  if (to) q = q.lte("scanned_at", `${to}T23:59:59.999+05:30`);
  if (view === "reject") q = q.eq("mode", "check").eq("decision", "REFUSE");
  else if (result) q = q.eq("applied_decision", result);

  const [{ data: devices }, { data }] = await Promise.all([devicesQuery, q.returns<Scan[]>()]);
  const scans = data ?? [];
  const tab = (v: string, label: string) => {
    const params = new URLSearchParams({ ...(device && { device }), ...(from && { from }), ...(to && { to }), ...(v === "reject" && { view: "reject" }) });
    return (
      <Link
        href={`/app/vendor/scans${params.size ? `?${params}` : ""}`}
        className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ${view === v ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink ring-line hover:ring-brand-300"}`}
      >
        {label}
      </Link>
    );
  };
  const small = inputClass.replace("px-4 py-3", "px-3 py-2");

  return (
    <>
      <PageTitle title="Scan log" subtitle="Every strip your devices scanned, with what the device decided and what the server did." />
      <div className="mb-4 flex flex-wrap gap-2">{tab("all", "All scans")}{tab("reject", "Reject bin")}</div>

      <form className="mb-6 grid gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line sm:grid-cols-5 sm:items-end">
        {view === "reject" && <input type="hidden" name="view" value="reject" />}
        <label className="text-xs font-medium text-muted">
          Device
          <select name="device" defaultValue={device} className={small}>
            <option value="">All devices</option>
            {(devices ?? []).map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">From<input name="from" type="date" defaultValue={from} className={small} /></label>
        <label className="text-xs font-medium text-muted">To<input name="to" type="date" defaultValue={to} className={small} /></label>
        <label className="text-xs font-medium text-muted">
          Result
          <select name="result" defaultValue={result} disabled={view === "reject"} className={small}>
            <option value="">Any</option>
            <option value="ACCEPT">Accepted</option>
            <option value="REVIEW">Review</option>
            <option value="REFUSE">Refused</option>
          </select>
        </label>
        <button className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Filter</button>
      </form>

      {scans.length === 0 ? (
        <Empty
          icon={<ScanLine className="h-6 w-6" />}
          title={view === "reject" ? "The reject bin is empty" : "No scans found"}
          body={view === "reject" ? "Strips a device refuses at sale time are listed here." : "Scans appear once a device uploads them."}
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">When</th><th className="px-4 py-3">Device</th><th className="px-4 py-3">Medicine · batch</th>
                <th className="px-4 py-3">Result</th><th className="px-4 py-3">Why / what happened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {scans.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                    {fmtTime(s.scanned_at)}
                    <span className="block capitalize">{s.mode}{s.mode === "restock" ? ` × ${s.quantity}` : s.sold ? " · sold" : ""}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">{s.device ? <>{s.device.name}<span className="block font-mono text-muted">{s.device.code}</span></> : "—"}</td>
                  <td className="px-4 py-3">
                    {s.product ? productLabel(s.product) : s.product_name ? `“${s.product_name}”` : <span className="text-muted">Not recognised</span>}
                    <span className="block font-mono text-xs text-muted">{s.fields.batch?.value || "no batch read"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Decision device={s.decision} applied={s.applied_decision} />
                    {reviewLabel[s.review_status] && <span className="mt-1 block text-[11px] text-muted">{reviewLabel[s.review_status]}</span>}
                  </td>
                  <td className="max-w-sm px-4 py-3 text-xs text-muted">
                    {s.reason && <span className="block text-ink">{s.reason}</span>}
                    {s.outcome}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {scans.length === LIMIT && <p className="mt-3 text-xs text-muted">Showing the latest {LIMIT}. Narrow the dates to see older scans.</p>}
    </>
  );
}
