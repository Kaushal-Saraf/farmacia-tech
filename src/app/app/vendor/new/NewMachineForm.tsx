"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2, ScanLine, Server } from "lucide-react";
import { Button } from "@/components/Button";
import type { DeviceType } from "@/lib/types";
import { registerDevice, type CredentialState } from "../actions";
import { Credentials } from "../Credentials";
import { inputClass } from "../../ui";

const types: { value: DeviceType; label: string; body: string; icon: typeof Server }[] = [
  { value: "vending", label: "Vending machine", body: "Dispenses prescribed medicines against a QR code.", icon: Server },
  { value: "checker", label: "Medicine Checker", body: "Camera bench that reads batch, dates and MRP from a strip.", icon: ScanLine },
];

export function NewMachineForm() {
  const [state, action, pending] = useActionState<CredentialState, FormData>(registerDevice, {});
  const [type, setType] = useState<DeviceType>("vending");

  if (state.created) {
    const c = state.created;
    return (
      <div className="space-y-6">
        <p className="font-bold text-ink">Registered. Hand the Device ID and pairing code to the operator.</p>
        <Credentials code={c.code} pairingCode={c.pairingCode} deviceKey={c.deviceKey} />
        <div className="flex flex-wrap gap-3">
          <Link href={`/app/vendor/${c.machineId}`} className="inline-flex items-center rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-600">
            Open device
          </Link>
          {/* Full reload so the one-time secrets don't linger in the page. */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center rounded-xl px-5 py-3 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50"
          >
            Register another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-ink">Type of device</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {types.map((t) => (
            <label
              key={t.value}
              className={`flex cursor-pointer gap-3 rounded-2xl p-4 ring-1 transition ${
                type === t.value ? "bg-brand-50 ring-2 ring-brand-500" : "ring-line hover:ring-brand-200"
              }`}
            >
              <input type="radio" name="type" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} className="sr-only" />
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${type === t.value ? "brand-gradient text-white" : "bg-brand-50 text-brand-500"}`}>
                <t.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-bold text-ink">{t.label}</span>
                <span className="block text-xs leading-snug text-muted">{t.body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="text-sm font-medium text-ink">
        Device ID <span className="font-normal text-muted">(leave blank to generate)</span>
        <input name="code" className={`${inputClass} font-mono uppercase`} placeholder={type === "vending" ? "FT-VM-…" : "FT-MC-…"} />
      </label>
      {type === "vending" && (
        <label className="text-sm font-medium text-ink">
          Number of slots
          <input name="slots" type="number" min={1} max={200} defaultValue={12} required className={inputClass} />
        </label>
      )}
      <label className="text-sm font-medium text-ink sm:col-span-2">
        Name <span className="font-normal text-muted">(optional, the operator can rename it)</span>
        <input name="name" maxLength={80} className={inputClass} placeholder={type === "vending" ? "Vending machine" : "Medicine Checker"} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Register device</Button>
      </div>
    </form>
  );
}
