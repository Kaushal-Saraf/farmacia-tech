"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import { createMachine, type MachineState } from "../actions";
import { inputClass } from "../../ui";

export function NewMachineForm() {
  const [state, action, pending] = useActionState<MachineState, FormData>(createMachine, {});
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-medium text-ink">
        Machine code
        <input name="code" required className={inputClass} placeholder="FT-GZB-001" />
      </label>
      <label className="text-sm font-medium text-ink">
        Number of slots
        <input name="slots" type="number" min={1} max={200} defaultValue={12} required className={inputClass} />
      </label>
      <label className="text-sm font-medium text-ink sm:col-span-2">
        Name
        <input name="name" required className={inputClass} placeholder="City Hospital, OPD gate" />
      </label>
      <label className="text-sm font-medium text-ink sm:col-span-2">
        Address
        <input name="address" className={inputClass} placeholder="Street, area, city" />
      </label>
      <label className="text-sm font-medium text-ink">
        Latitude <span className="font-normal text-muted">(optional)</span>
        <input name="latitude" inputMode="decimal" className={inputClass} placeholder="28.6692" />
      </label>
      <label className="text-sm font-medium text-ink">
        Longitude <span className="font-normal text-muted">(optional)</span>
        <input name="longitude" inputMode="decimal" className={inputClass} placeholder="77.4538" />
      </label>
      <label className="text-sm font-medium text-ink sm:col-span-2">
        Operator's mobile <span className="font-normal text-muted">(optional, they must have signed in once)</span>
        <input name="owner_phone" type="tel" inputMode="numeric" maxLength={10} className={inputClass} placeholder="98765 43210" />
      </label>
      <p className="text-xs text-muted sm:col-span-2">Tip: in Google Maps, right-click the spot and click the coordinates to copy them.</p>
      {state.error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Create machine</Button>
      </div>
    </form>
  );
}
