"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { changeStock, type StockState } from "./actions";

const field = "w-20 rounded-lg border-0 bg-white px-2.5 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-500 focus:outline-none";
const tabs = [
  { key: "set", label: "Set count" },
  { key: "sold", label: "Record sold" },
  { key: "remove", label: "Remove" },
] as const;

/** The three hand edits for one stock row. Each is logged with who did it. */
export function RowActions({
  stockId,
  machineId,
  quantity,
  canSell,
  lockReason,
}: {
  stockId: string;
  machineId: string;
  quantity: number;
  canSell: boolean;
  lockReason: string | null;
}) {
  const [state, action, pending] = useActionState<StockState, FormData>(changeStock, {});
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>(canSell ? "sold" : "remove");
  const suggested = lockReason === "expired" ? "removed_expired" : lockReason === "recalled" ? "removed_recalled" : "manual_removed";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            disabled={t.key === "sold" && !canSell}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
              tab === t.key ? "bg-brand-500 text-white" : "bg-white text-ink ring-1 ring-line hover:ring-brand-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* key: reset the inputs when switching tabs or after a save */}
      <form key={`${tab}-${quantity}`} action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="stock_id" value={stockId} />
        <input type="hidden" name="machine_id" value={machineId} />
        <input type="hidden" name="action" value={tab} />
        <label className="text-xs font-medium text-muted">
          {tab === "set" ? "Counted" : "How many"}
          <input
            name="quantity"
            type="number"
            required
            min={tab === "set" ? 0 : 1}
            max={tab === "set" ? 100000 : quantity}
            defaultValue={tab === "set" ? quantity : 1}
            className={`mt-1 block ${field}`}
          />
        </label>
        {tab === "remove" && (
          <label className="text-xs font-medium text-muted">
            Reason
            <select name="reason" defaultValue={suggested} className={`mt-1 block ${field} w-40`}>
              <option value="removed_expired">Expired</option>
              <option value="removed_recalled">Recalled</option>
              <option value="manual_removed">Damaged / other</option>
            </select>
          </label>
        )}
        <label className="min-w-40 flex-1 text-xs font-medium text-muted">
          Note <span className="font-normal">(optional)</span>
          <input name="note" maxLength={500} className={`mt-1 block ${field} w-full`} placeholder={tab === "set" ? "Physical count" : ""} />
        </label>
        <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save
        </button>
      </form>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.ok && !pending && <p className="text-sm font-medium text-brand-700">{state.ok}</p>}
      {!canSell && lockReason && (
        <p className="text-xs text-red-700">Locked from sale ({lockReason.replace("_", " ")}). It can only be removed.</p>
      )}
    </div>
  );
}
