"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import { applyAsDoctor, type FormState } from "../actions";
import { inputClass } from "../ui";

const councils = [
  "National Medical Commission (NMC)",
  "Delhi Medical Council",
  "Uttar Pradesh Medical Council",
  "Maharashtra Medical Council",
  "Karnataka Medical Council",
  "Tamil Nadu Medical Council",
  "Other State Medical Council",
];

export function ApplicationForm({ defaults }: { defaults?: Partial<Record<string, string>> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(applyAsDoctor, {});
  if (state.ok) {
    return <p className="rounded-xl bg-brand-50 p-4 text-sm font-medium text-brand-800">Submitted. We'll review your details shortly.</p>;
  }
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-medium text-ink sm:col-span-2">
        Name as registered
        <input name="full_name" required defaultValue={defaults?.full_name} className={inputClass} placeholder="Dr. Firstname Lastname" />
      </label>
      <label className="text-sm font-medium text-ink">
        Registration number
        <input name="registration_no" required defaultValue={defaults?.registration_no} className={inputClass} placeholder="e.g. DMC/R/12345" />
      </label>
      <label className="text-sm font-medium text-ink">
        Qualification
        <input name="qualification" required defaultValue={defaults?.qualification} className={inputClass} placeholder="MBBS, MD" />
      </label>
      <label className="text-sm font-medium text-ink sm:col-span-2">
        Medical council
        <select name="council" required defaultValue={defaults?.council ?? ""} className={inputClass}>
          <option value="" disabled>Select…</option>
          {councils.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Submit for verification
        </Button>
      </div>
    </form>
  );
}
