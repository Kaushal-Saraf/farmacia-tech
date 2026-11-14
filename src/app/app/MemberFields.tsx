import { relations } from "@/lib/family";
import type { FamilyMember } from "@/lib/types";
import { inputClass } from "./ui";

/** Name, relation, date of birth and gender: shared by the patient's and the doctor's family forms. */
export function MemberFields({
  defaults,
  allowSelf = false,
  compact = false,
}: {
  defaults?: Partial<FamilyMember>;
  allowSelf?: boolean;
  compact?: boolean;
}) {
  const input = compact ? inputClass.replace("px-4 py-3", "px-3 py-2.5") : inputClass;
  const isSelf = defaults?.relation === "self";
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <label className="text-sm font-medium text-ink sm:col-span-2">
        Full name
        <input name="full_name" required maxLength={120} defaultValue={defaults?.full_name} className={input} placeholder="e.g. Aarav Kumar" />
      </label>
      {isSelf ? (
        <input type="hidden" name="relation" value="self" />
      ) : (
        <label className="text-sm font-medium text-ink">
          Relation
          <select name="relation" required defaultValue={defaults?.relation ?? ""} className={input}>
            <option value="" disabled>Select…</option>
            {allowSelf && <option value="self">Account holder (self)</option>}
            {relations.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
      )}
      <label className="text-sm font-medium text-ink">
        Gender <span className="font-normal text-muted">(optional)</span>
        <select name="gender" defaultValue={defaults?.gender ?? ""} className={input}>
          <option value="">Not given</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="text-sm font-medium text-ink">
        Date of birth <span className="font-normal text-muted">(optional)</span>
        <input name="birth_date" type="date" min="1900-01-01" max={today} defaultValue={defaults?.birth_date ?? ""} className={input} />
      </label>
    </>
  );
}
