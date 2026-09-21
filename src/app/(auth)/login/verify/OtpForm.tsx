"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import { verifyOtp, type AuthState } from "../actions";

export function OtpForm({ phone, next }: { phone: string; next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(verifyOtp, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium text-ink">
        6-digit code
        <input
          name="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
          pattern="[0-9]{6}"
          autoFocus
          placeholder="••••••"
          className="mt-1.5 block w-full rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-ink ring-1 ring-inset ring-line outline-none focus:ring-2 focus:ring-brand-500"
        />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Verify & continue
      </Button>
    </form>
  );
}
