import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { requireSide } from "@/lib/auth";
import { YEAR_MONTH, normaliseMrp, productLabel } from "@/lib/medicine";
import type { DeviceType, ScanDecision } from "@/lib/types";
import { deleteReview } from "./actions";
import { ReviewForm } from "./ReviewForm";
import { Decision, FieldsRead, fmtTime, type ScanFields } from "../scan-ui";
import { Card, Empty, PageTitle } from "../../ui";

export const metadata: Metadata = { title: "Review" };

type Item = {
  id: string;
  mode: "restock" | "check";
  scanned_at: string;
  product_id: string | null;
  product_name: string | null;
  fields: ScanFields;
  decision: ScanDecision;
  applied_decision: ScanDecision | null;
  reason: string | null;
  person_answer: string | null;
  quantity: number;
  outcome: string | null;
  device: { code: string; name: string; type: DeviceType; slots: { slot_no: number }[] } | null;
  product: { name: string; strength: string | null } | null;
};

export default async function ReviewPage() {
  const { supabase, profile, side } = await requireSide("vendor");

  let query = supabase
    .from("scan_events")
    .select("id, mode, scanned_at, product_id, product_name, fields, decision, applied_decision, reason, person_answer, quantity, outcome, device:machines(code, name, type, slots:machine_slots(slot_no)), product:products(name, strength)")
    .eq("review_status", "open")
    .order("scanned_at", { ascending: false })
    .limit(100);
  if (side !== "admin") query = query.eq("vendor_id", profile.id);
  const [{ data }, { data: productRows }] = await Promise.all([
    query.returns<Item[]>(),
    supabase.from("products").select("id, name, strength, manufacturer").order("name").order("strength").limit(5000),
  ]);
  const items = data ?? [];
  const products = (productRows ?? []).map((p) => ({ id: p.id as string, label: `${productLabel(p)}${p.manufacturer ? ` — ${p.manufacturer}` : ""}` }));

  return (
    <>
      <PageTitle
        title="Review"
        subtitle="Scans that need you: unknown medicine, not-confirmed batch, a refused strip, or a sale the device couldn't match."
      />
      {items.length === 0 ? (
        <Empty icon={<ClipboardCheck className="h-6 w-6" />} title="Nothing to review" body="New items appear here when a device can't be sure about a strip." />
      ) : (
        <div className="space-y-5">
          {items.map((it) => {
            const ok = (v: string | undefined, re: RegExp) => (v && re.test(v) ? v : "");
            const defaults = {
              productId: it.product_id ?? "",
              batch: it.fields.batch?.value ?? "",
              mfd: ok(it.fields.mfd?.value, YEAR_MONTH),
              exp: ok(it.fields.exp?.value, YEAR_MONTH),
              mrp: it.fields.mrp?.value ? normaliseMrp(it.fields.mrp.value) ?? "" : "",
              quantity: it.quantity,
            };
            return (
              <Card key={it.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="rounded-full bg-surface px-2 py-0.5 font-semibold capitalize text-ink ring-1 ring-line">{it.mode}</span>
                      <Decision device={it.decision} applied={it.applied_decision} />
                      <span>{fmtTime(it.scanned_at)}</span>
                      {it.device && <span>· {it.device.name} <span className="font-mono">{it.device.code}</span></span>}
                    </p>
                    <h2 className="mt-2 font-bold text-ink">
                      {it.product ? productLabel(it.product) : it.product_name ? `Read as “${it.product_name}”` : "Medicine not recognised"}
                      {it.mode === "restock" && <span className="ml-2 text-sm font-normal text-muted">× {it.quantity}</span>}
                    </h2>
                  </div>
                  <form action={deleteReview}>
                    <input type="hidden" name="event_id" value={it.id} />
                    <button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50">Delete</button>
                  </form>
                </div>
                <div className="mt-4 rounded-xl bg-surface p-4"><FieldsRead fields={it.fields} /></div>
                {(it.outcome || it.reason || it.person_answer) && (
                  <ul className="mt-3 space-y-0.5 text-sm text-muted">
                    {it.outcome && <li><span className="font-semibold text-ink">What happened:</span> {it.outcome}</li>}
                    {it.reason && <li><span className="font-semibold text-ink">Device note:</span> {it.reason}</li>}
                    {it.person_answer && <li><span className="font-semibold text-ink">Person answered:</span> {it.person_answer}</li>}
                  </ul>
                )}
                <div className="mt-4 border-t border-line pt-4">
                  <ReviewForm
                    eventId={it.id}
                    mode={it.mode}
                    deviceType={it.device?.type ?? "checker"}
                    slots={(it.device?.slots ?? []).map((s) => s.slot_no).sort((a, b) => a - b)}
                    products={products}
                    defaults={defaults}
                  />
                </div>
                {it.mode === "restock" && <p className="mt-2 text-xs text-muted">Delete takes back anything this scan added to stock.</p>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
