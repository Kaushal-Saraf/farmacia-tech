"use client";

import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";

function CopyRow({ label, value, hint, multiline = false }: { label: string; value: string; hint: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-line">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-1.5 flex items-center gap-3">
        <code className={`flex-1 break-all font-mono text-ink ${multiline ? "whitespace-pre-wrap rounded-lg bg-surface p-3 text-xs" : "text-lg font-bold"}`}>{value}</code>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(value).then(() => setCopied(true), () => {})}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

/** Shows freshly made secrets. They can't be shown again, so say so clearly. */
export function Credentials({ code, pairingCode, deviceKey, baseUrl }: { code: string; pairingCode?: string; deviceKey?: string; baseUrl?: string }) {
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        Copy these now. For safety they are not stored and can&apos;t be shown again. You can issue new ones from the device page.
      </p>
      <CopyRow label="Device ID" value={code} hint="Printed on the device. The operator needs it to link the device." />
      {pairingCode && (
        <CopyRow label="Pairing code" value={pairingCode} hint="Give this to the operator with the Device ID. It works once." />
      )}
      {deviceKey && (
        <CopyRow label="Device key" value={deviceKey} hint="Load this into the device software. Never give it to anyone else." />
      )}
      {deviceKey && baseUrl && (
        <CopyRow
          label="Device config file (config.json)"
          multiline
          value={JSON.stringify({ baseUrl, deviceId: code, deviceKey }, null, 2)}
          hint={`Save on the device as config.json, readable only by the app (chmod 600). ${
            baseUrl.includes("localhost") ? "localhost only works on this computer: on the device use this computer's network address, e.g. http://192.168.1.20:3000." : ""
          }`}
        />
      )}
    </div>
  );
}
