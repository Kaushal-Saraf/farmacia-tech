"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import { saveName, type FormState } from "../actions";
import { inputClass } from "../ui";

export function NameForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(saveName, {});
  return (
    <form action={action} className="space-y-5">
      <label className="block text-sm font-medium text-ink">
        Full name
        <input name="full_name" required autoComplete="name" autoFocus className={inputClass} placeholder="As on your ID" />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Continue
      </Button>
    </form>
  );
}
