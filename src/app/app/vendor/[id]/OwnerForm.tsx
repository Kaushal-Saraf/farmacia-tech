"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import { assignOwner, type MachineState } from "../actions";
import { inputClass } from "../../ui";

export function OwnerForm({ machineId }: { machineId: string }) {
  const [state, action, pending] = useActionState<MachineState, FormData>(assignOwner, {});
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="machine_id" value={machineId} />
      <label className="flex-1 text-sm font-medium text-ink">
        Operator's mobile number
        <input name="owner_phone" type="tel" inputMode="numeric" maxLength={10} required className={inputClass} placeholder="98765 43210" />
      </label>
      <Button type="submit" variant="secondary" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Assign</Button>
      {(state.error || state.ok) && (
        <p className={`text-sm sm:basis-full ${state.error ? "text-red-600" : "text-brand-700"}`}>{state.error ?? state.ok}</p>
      )}
    </form>
  );
}
