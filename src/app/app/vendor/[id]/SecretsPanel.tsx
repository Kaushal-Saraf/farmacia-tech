"use client";

import { useActionState } from "react";
import { KeyRound, Link2, Loader2 } from "lucide-react";
import { resetDeviceSecret, type CredentialState } from "../actions";
import { Credentials } from "../Credentials";

const btn =
  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50 disabled:opacity-60";

/** Admin only: issue a new pairing code (e.g. to hand the device to a new operator) or a new device key. */
export function SecretsPanel({ machineId, linked }: { machineId: string; linked: boolean }) {
  const [state, action, pending] = useActionState<CredentialState, FormData>(resetDeviceSecret, {});
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap gap-3">
        <input type="hidden" name="machine_id" value={machineId} />
        <button
          name="which"
          value="pairing"
          disabled={pending}
          className={btn}
          onClick={(e) => {
            if (linked && !confirm("A new pairing code lets another operator take over this device. Continue?")) e.preventDefault();
          }}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} New pairing code
        </button>
        <button
          name="which"
          value="key"
          disabled={pending}
          className={btn}
          onClick={(e) => {
            if (!confirm("The device stops connecting until the new key is loaded into it. Continue?")) e.preventDefault();
          }}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} New device key
        </button>
      </form>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.created && (
        <Credentials code={state.created.code} pairingCode={state.created.pairingCode} deviceKey={state.created.deviceKey} baseUrl={state.created.baseUrl} />
      )}
    </div>
  );
}
