"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import { addRecall, type RecallState } from "./actions";
import { inputClass } from "../../ui";

export function RecallForm({ products }: { products: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<RecallState, FormData>(addRecall, {});
  return (
    <form key={state.ok} action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-ink sm:col-span-2">
        Medicine
        <select name="product_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>Select…</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium text-ink">
        Batch number
        <input name="batch_code" required maxLength={40} autoCapitalize="characters" spellCheck={false} className={`${inputClass} font-mono uppercase`} placeholder="NBT-240586" />
      </label>
      <label className="text-sm font-medium text-ink">
        Recall date
        <input name="recalled_on" type="date" className={inputClass} />
      </label>
      <label className="text-sm font-medium text-ink sm:col-span-2">
        Reason
        <input name="reason" required maxLength={500} className={inputClass} placeholder="e.g. Not of standard quality (CDSCO alert)" />
      </label>
      <label className="text-sm font-medium text-ink sm:col-span-2">
        Notice reference <span className="font-normal text-muted">(optional)</span>
        <input name="notice_ref" maxLength={120} className={inputClass} placeholder="CDSCO alert no." />
      </label>
      <div className="flex items-center gap-4 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Add to recall list</Button>
        {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
        {state.ok && !pending && <p className="text-sm font-medium text-brand-700">{state.ok}</p>}
      </div>
    </form>
  );
}
