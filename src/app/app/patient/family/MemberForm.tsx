"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import type { FamilyMember } from "@/lib/types";
import { addMember, updateMember, type FamilyState } from "../actions";
import { MemberFields } from "../../MemberFields";

export function MemberForm({ member }: { member?: FamilyMember }) {
  const [state, action, pending] = useActionState<FamilyState, FormData>(member ? updateMember : addMember, {});
  return (
    // A fresh key after each successful add clears the form for the next person.
    <form key={member ? member.id : state.ok} action={action} className="grid gap-4 sm:grid-cols-2">
      {member && <input type="hidden" name="id" value={member.id} />}
      <MemberFields defaults={member} />
      <div className="flex items-center gap-4 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} {member ? "Save" : "Add to family"}</Button>
        {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
        {state.ok && !pending && <p className="text-sm font-medium text-brand-700">{state.ok}</p>}
      </div>
    </form>
  );
}
