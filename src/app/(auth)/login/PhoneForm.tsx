"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import { sendOtp, type AuthState } from "./actions";

export function PhoneForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(sendOtp, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium text-ink">
        Mobile number
        <div className="mt-1.5 flex rounded-xl ring-1 ring-inset ring-line focus-within:ring-2 focus-within:ring-brand-500">
          <span className="flex items-center border-r border-line px-4 text-sm font-semibold text-muted">+91</span>
          <input
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            required
            maxLength={10}
            pattern="[6-9][0-9]{9}"
            placeholder="98765 43210"
            className="w-full rounded-r-xl bg-transparent px-4 py-3 text-base tracking-wide text-ink outline-none placeholder:text-muted/50"
          />
        </div>
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Send OTP
      </Button>
    </form>
  );
}
