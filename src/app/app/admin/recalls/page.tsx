import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { requireSide, requireViewer } from "@/lib/auth";
import { productLabel } from "@/lib/medicine";
import { removeRecall } from "./actions";
import { RecallForm } from "./RecallForm";
import { Card, Empty, PageTitle } from "../../ui";

export const metadata: Metadata = { title: "Recalls" };

type Recall = { id: string; batch_code: string; reason: string; notice_ref: string | null; recalled_on: string; product: { id: string; name: string; strength: string | null } | null };

/** The shared recall list. A recalled batch is locked from sale everywhere, including on devices. */
export default async function RecallsPage() {
  await requireSide("admin");
  const { supabase } = await requireViewer(["admin"]);
  const [{ data: recalls }, { data: products }, { data: affected }] = await Promise.all([
    supabase.from("recalls").select("id, batch_code, reason, notice_ref, recalled_on, product:products(id, name, strength)").order("recalled_on", { ascending: false }).returns<Recall[]>(),
    supabase.from("products").select("id, name, strength, manufacturer").order("name").order("strength").limit(5000),
    supabase.from("stock_status").select("product_id, batch_code, quantity, machine_id").eq("lock_reason", "recalled").gt("quantity", 0),
  ]);
  const impact = (r: Recall) => {
    const rows = (affected ?? []).filter((a) => a.product_id === r.product?.id && a.batch_code === r.batch_code);
    return { units: rows.reduce((n, a) => n + (a.quantity as number), 0), devices: new Set(rows.map((a) => a.machine_id)).size };
  };

  return (
    <>
      <PageTitle title="Recalls" subtitle="Batches on this list are locked from sale on every device, and operators are told to remove them." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card className="h-fit">
          <h2 className="mb-4 font-bold text-ink">Add a recalled batch</h2>
          <RecallForm products={(products ?? []).map((p) => ({ id: p.id as string, label: `${productLabel(p)}${p.manufacturer ? ` — ${p.manufacturer}` : ""}` }))} />
        </Card>
        <div>
          {!recalls?.length ? (
            <Empty icon={<ShieldAlert className="h-6 w-6" />} title="No recalls" body="Add a batch when a recall notice is issued." />
          ) : (
            <ul className="space-y-3">
              {recalls.map((r) => {
                const i = impact(r);
                return (
                  <li key={r.id}>
                    <Card className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-ink">{r.product ? productLabel(r.product) : "—"} <span className="font-mono text-sm">{r.batch_code}</span></p>
                          <p className="mt-0.5 text-sm text-muted">{r.reason}</p>
                          <p className="mt-1 text-xs text-muted">
                            {new Date(r.recalled_on).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            {r.notice_ref && ` · ${r.notice_ref}`}
                          </p>
                        </div>
                        <form action={removeRecall}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted ring-1 ring-inset ring-line hover:text-red-600">Lift recall</button>
                        </form>
                      </div>
                      <p className={`mt-3 text-xs font-semibold ${i.units ? "text-red-700" : "text-emerald-700"}`}>
                        {i.units ? `${i.units} units still on ${i.devices} device${i.devices > 1 ? "s" : ""}` : "None left on any device"}
                      </p>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
