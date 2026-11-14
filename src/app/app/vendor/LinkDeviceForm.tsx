"use client";

import { useActionState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import { linkDevice, type DeviceFormState } from "./actions";
import { inputClass } from "../ui";

export function LinkDeviceForm() {
  const [state, action, pending] = useActionState<DeviceFormState, FormData>(linkDevice, {});
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-medium text-ink">
        Device ID
        <input
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className={`${inputClass} font-mono uppercase`}
          placeholder="FT-VM-7K3Q9X"
        />
      </label>
      <label className="text-sm font-medium text-ink">
        Pairing code
        <input
          name="pairing_code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={12}
          className={`${inputClass} font-mono uppercase`}
          placeholder="K7QM-3XHP"
        />
      </label>
      <p className="text-xs text-muted sm:col-span-2">
        Both are on the card Farmacia Tech gave you with the device. The pairing code works once.
      </p>
      {state.error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Link device
        </Button>
      </div>
    </form>
  );
}
