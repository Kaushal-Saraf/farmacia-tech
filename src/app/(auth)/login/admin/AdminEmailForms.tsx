"use client";

import { useActionState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/Button";
import { sendAdminCode, verifyAdminCode, type AdminAuthState } from "./actions";

const input =
  "mt-1.5 block w-full rounded-xl px-4 py-3 text-base text-ink ring-1 ring-inset ring-line outline-none focus:ring-2 focus:ring-brand-500";

export function AdminEmailForm() {
  const [state, action, pending] = useActionState<AdminAuthState, FormData>(sendAdminCode, {});
  return (
    <form action={action} className="space-y-5">
      <label className="block text-sm font-medium text-ink">
        Admin email
        <input name="email" type="email" required autoComplete="email" autoFocus placeholder="admin@example.com" className={input} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Email me a code
      </Button>
    </form>
  );
}

export function AdminCodeForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<AdminAuthState, FormData>(verifyAdminCode, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="email" value={email} />
      <label className="block text-sm font-medium text-ink">
        Code from the email
        <input
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={10}
          pattern="[0-9]{6,10}"
          autoFocus
          placeholder="••••••"
          className={`${input} text-center text-2xl font-bold tracking-[0.4em]`}
        />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Continue
      </Button>
    </form>
  );
}
