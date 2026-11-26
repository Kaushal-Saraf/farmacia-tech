import type { FieldStatus, ScanDecision } from "@/lib/types";

export type ScanFields = Partial<Record<"batch" | "mfd" | "exp" | "mrp", { value: string; status: FieldStatus }>>;

const decisionTone: Record<ScanDecision, string> = {
  ACCEPT: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REVIEW: "bg-amber-50 text-amber-800 ring-amber-200",
  REFUSE: "bg-red-50 text-red-700 ring-red-200",
};

export function Decision({ device, applied }: { device: ScanDecision; applied: ScanDecision | null }) {
  const a = applied ?? device;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${decisionTone[a]}`}>{a}</span>
      {applied && applied !== device && <span className="text-[11px] text-muted">device said {device}</span>}
    </span>
  );
}

const statusLabel: Record<FieldStatus, string> = { confirmed: "confirmed", read: "read", from_record: "from record", not_found: "not found" };
const statusTone: Record<FieldStatus, string> = {
  confirmed: "text-emerald-700",
  read: "text-ink",
  from_record: "text-brand-700",
  not_found: "text-red-600",
};

/** Batch, MFD, EXP and MRP as the device read them, with how sure it was. */
export function FieldsRead({ fields }: { fields: ScanFields }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
      {(["batch", "mfd", "exp", "mrp"] as const).map((k) => {
        const f = fields[k];
        return (
          <div key={k}>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k === "batch" ? "Batch" : k.toUpperCase()}</dt>
            <dd className="font-mono text-ink">{f?.value || "—"}</dd>
            <dd className={`text-[11px] ${statusTone[f?.status ?? "not_found"]}`}>{statusLabel[f?.status ?? "not_found"]}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
