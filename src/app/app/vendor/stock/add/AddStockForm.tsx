"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import type { DeviceType } from "@/lib/types";
import { addStock, type StockState } from "../actions";
import { inputClass } from "../../../ui";

type Device = { id: string; code: string; name: string; type: DeviceType; slots: number[] };
type Product = { id: string; name: string; strength: string | null; manufacturer: string | null };

export function AddStockForm({ devices, products, shelves, initialDevice }: {
  devices: Device[];
  products: Product[];
  shelves: string[];
  initialDevice: string;
}) {
  const [state, action, pending] = useActionState<StockState, FormData>(addStock, {});
  const [deviceId, setDeviceId] = useState(initialDevice);
  const [productId, setProductId] = useState(products.length ? "" : "new");
  const device = devices.find((d) => d.id === deviceId) ?? devices[0];

  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-medium text-ink sm:col-span-2">
        Device
        <select name="machine_id" value={device.id} onChange={(e) => setDeviceId(e.target.value)} className={inputClass}>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-ink sm:col-span-2">
        Medicine
        <select name="product_id" required value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
          <option value="" disabled>Select…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{[p.name, p.strength].filter(Boolean).join(" ")}{p.manufacturer ? ` — ${p.manufacturer}` : ""}</option>
          ))}
          <option value="new">+ A medicine not in this list</option>
        </select>
      </label>
      {productId === "new" && (
        <div className="grid gap-4 rounded-xl bg-surface p-4 ring-1 ring-line sm:col-span-2 sm:grid-cols-2">
          <p className="text-xs text-muted sm:col-span-2">This adds the medicine to the shared list all operators use, so type it as printed on the pack.</p>
          <label className="text-sm font-medium text-ink sm:col-span-2">
            Medicine name
            <input name="new_name" required maxLength={120} className={inputClass} placeholder="e.g. Dolo 650" />
          </label>
          <label className="text-sm font-medium text-ink">
            Strength <span className="font-normal text-muted">(optional)</span>
            <input name="new_strength" maxLength={60} className={inputClass} placeholder="650 mg" />
          </label>
          <label className="text-sm font-medium text-ink">
            Pack size <span className="font-normal text-muted">(optional)</span>
            <input name="new_pack_size" maxLength={60} className={inputClass} placeholder="15 tablets" />
          </label>
          <label className="text-sm font-medium text-ink sm:col-span-2">
            Manufacturer <span className="font-normal text-muted">(optional)</span>
            <input name="new_manufacturer" maxLength={120} className={inputClass} placeholder="Micro Labs" />
          </label>
        </div>
      )}

      <label className="text-sm font-medium text-ink sm:col-span-2">
        Batch number <span className="font-normal text-muted">(exactly as printed)</span>
        <input
          name="batch_code"
          required
          maxLength={40}
          autoCapitalize="characters"
          spellCheck={false}
          className={`${inputClass} font-mono uppercase`}
          placeholder="NBT-240586"
        />
      </label>
      <label className="text-sm font-medium text-ink">
        MFD
        <input name="mfd" type="month" required className={inputClass} />
      </label>
      <label className="text-sm font-medium text-ink">
        EXP
        <input name="exp" type="month" required className={inputClass} />
      </label>
      <label className="text-sm font-medium text-ink">
        MRP (₹)
        <input name="mrp" inputMode="decimal" required className={inputClass} placeholder="140.70" />
      </label>
      <label className="text-sm font-medium text-ink">
        Quantity <span className="font-normal text-muted">({device.type === "vending" ? "packs" : "strips"})</span>
        <input name="quantity" type="number" min={1} max={10000} defaultValue={1} required className={inputClass} />
      </label>

      {device.type === "vending" ? (
        <label className="text-sm font-medium text-ink">
          Slot
          <select key={device.id} name="slot_no" required defaultValue="" className={inputClass}>
            <option value="" disabled>Select…</option>
            {device.slots.map((s) => <option key={s} value={s}>Slot {s}</option>)}
          </select>
        </label>
      ) : (
        <label className="text-sm font-medium text-ink">
          Shelf <span className="font-normal text-muted">(optional)</span>
          <input key={device.id} name="shelf" maxLength={40} list="shelves" className={inputClass} placeholder="e.g. A1" />
          <datalist id="shelves">{shelves.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
      )}
      <label className="text-sm font-medium text-ink">
        Note <span className="font-normal text-muted">(optional)</span>
        <input name="note" maxLength={500} className={inputClass} />
      </label>

      {state.error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Add stock</Button>
      </div>
    </form>
  );
}
