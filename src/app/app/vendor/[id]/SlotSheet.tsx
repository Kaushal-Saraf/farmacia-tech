"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import { saveSlots, type MachineState } from "../actions";

export type Slot = {
  id: string;
  slot_no: number;
  medicine_name: string | null;
  strength: string | null;
  units_per_pack: number | null;
  price_paise: number | null;
  stock_packs: number;
  reserved_packs: number;
  batch_no: string | null;
  expires_on: string | null;
};

const cell = "w-full rounded-lg border-0 bg-white px-2.5 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-500 focus:outline-none";

export function SlotSheet({ machineId, slots, today }: { machineId: string; slots: Slot[]; today: string }) {
  const [state, action, pending] = useActionState<MachineState, FormData>(saveSlots, {});
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);
  const soonIso = soon.toISOString().slice(0, 10);

  return (
    <form action={action}>
      <input type="hidden" name="machine_id" value={machineId} />
      <div className="overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-line">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-3">Slot</th>
              <th className="px-3 py-3">Medicine</th>
              <th className="px-3 py-3">Strength</th>
              <th className="px-3 py-3">Units/pack</th>
              <th className="px-3 py-3">Price ₹</th>
              <th className="px-3 py-3">Stock (packs)</th>
              <th className="px-3 py-3">Batch</th>
              <th className="px-3 py-3">Expiry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {slots.map((s) => {
              const f = (name: string) => `s:${s.id}:${name}`;
              const expired = s.expires_on && s.expires_on < today;
              const expiring = !expired && s.expires_on && s.expires_on < soonIso;
              const low = s.medicine_name && s.stock_packs <= 2;
              return (
                <tr key={s.id} className={expired ? "bg-red-50/60" : expiring || low ? "bg-amber-50/60" : ""}>
                  <td className="px-3 py-2 font-bold text-brand-700">{s.slot_no}</td>
                  <td className="px-3 py-2"><input name={f("medicine")} defaultValue={s.medicine_name ?? ""} className={cell} placeholder="Empty" /></td>
                  <td className="px-3 py-2 w-28"><input name={f("strength")} defaultValue={s.strength ?? ""} className={cell} /></td>
                  <td className="px-3 py-2 w-24"><input name={f("units")} type="number" min={1} defaultValue={s.units_per_pack ?? ""} className={cell} /></td>
                  <td className="px-3 py-2 w-28"><input name={f("price")} type="number" min={0} step="0.01" defaultValue={s.price_paise != null ? (s.price_paise / 100).toFixed(2) : ""} className={cell} /></td>
                  <td className="px-3 py-2 w-28">
                    <input name={f("stock")} type="number" min={0} defaultValue={s.stock_packs} className={cell} />
                    {s.reserved_packs > 0 && <span className="mt-1 block text-[11px] text-muted">{s.reserved_packs} reserved</span>}
                  </td>
                  <td className="px-3 py-2 w-28"><input name={f("batch")} defaultValue={s.batch_no ?? ""} className={cell} /></td>
                  <td className="px-3 py-2 w-40">
                    <input name={f("expiry")} type="date" defaultValue={s.expires_on ?? ""} className={cell} />
                    {expired && <span className="mt-1 block text-[11px] font-semibold text-red-700">Expired</span>}
                    {expiring && <span className="mt-1 block text-[11px] font-semibold text-amber-700">Expires soon</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-end gap-4">
        {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
        {state.ok && !pending && <p className="text-sm font-medium text-brand-700">{state.ok}</p>}
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save stock</Button>
      </div>
    </form>
  );
}
