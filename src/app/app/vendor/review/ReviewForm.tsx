"use client";

import { useActionState, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { DeviceType } from "@/lib/types";
import { confirmReview, type ReviewState } from "./actions";

const cell = "mt-1 block w-full rounded-lg border-0 bg-white px-2.5 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-500 focus:outline-none";
type Product = { id: string; label: string };

export function ReviewForm({
  eventId, mode, deviceType, slots, products, defaults,
}: {
  eventId: string;
  mode: "restock" | "check";
  deviceType: DeviceType;
  slots: number[];
  products: Product[];
  defaults: { productId: string; batch: string; mfd: string; exp: string; mrp: string; quantity: number };
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(confirmReview, {});
  const [productId, setProductId] = useState(defaults.productId);

  if (state.ok) return <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4" /> {state.ok}</p>;

  if (mode === "check") {
    return (
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="mode" value="check" />
        <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Mark as reviewed
        </button>
        {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      </form>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="mode" value="restock" />
      <div className="grid gap-3 sm:grid-cols-6">
        <label className="text-xs font-medium text-muted sm:col-span-6">
          Medicine
          <select name="product_id" required value={productId} onChange={(e) => setProductId(e.target.value)} className={cell}>
            <option value="" disabled>Choose the medicine…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            <option value="new">+ A medicine not in this list</option>
          </select>
        </label>
        {productId === "new" && (
          <>
            <label className="text-xs font-medium text-muted sm:col-span-3">Name<input name="new_name" required maxLength={120} className={cell} /></label>
            <label className="text-xs font-medium text-muted sm:col-span-1">Strength<input name="new_strength" maxLength={60} className={cell} /></label>
            <label className="text-xs font-medium text-muted sm:col-span-2">Manufacturer<input name="new_manufacturer" maxLength={120} className={cell} /></label>
            <input type="hidden" name="new_pack_size" value="" />
          </>
        )}
        <label className="text-xs font-medium text-muted sm:col-span-2">
          Batch number
          <input name="batch_code" required maxLength={40} defaultValue={defaults.batch} autoCapitalize="characters" spellCheck={false} className={`${cell} font-mono uppercase`} />
        </label>
        <label className="text-xs font-medium text-muted">MFD<input name="mfd" type="month" required defaultValue={defaults.mfd} className={cell} /></label>
        <label className="text-xs font-medium text-muted">EXP<input name="exp" type="month" required defaultValue={defaults.exp} className={cell} /></label>
        <label className="text-xs font-medium text-muted">MRP ₹<input name="mrp" inputMode="decimal" required defaultValue={defaults.mrp} className={cell} /></label>
        <label className="text-xs font-medium text-muted">Quantity<input name="quantity" type="number" min={1} max={10000} required defaultValue={defaults.quantity} className={cell} /></label>
        {deviceType === "vending" ? (
          <label className="text-xs font-medium text-muted sm:col-span-2">
            Slot
            <select name="slot_no" required defaultValue="" className={cell}>
              <option value="" disabled>Select…</option>
              {slots.map((s) => <option key={s} value={s}>Slot {s}</option>)}
            </select>
          </label>
        ) : (
          <label className="text-xs font-medium text-muted sm:col-span-2">Shelf <span className="font-normal">(optional)</span><input name="shelf" maxLength={40} className={cell} /></label>
        )}
      </div>
      <p className="text-xs text-muted">Check against the strip. Change anything the device got wrong; the batch is then confirmed for everyone.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
        </button>
        {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
