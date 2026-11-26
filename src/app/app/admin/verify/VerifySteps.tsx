"use client";

import { useActionState, useState, useTransition } from "react";
import { KeyRound, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/Button";
import { setPin, startEnroll, unlockAdmin, verifyCode, type EnrollState, type VerifyState } from "./actions";
import { inputClass } from "../../ui";

const codeInput = `${inputClass} text-center font-mono text-2xl tracking-[0.4em]`;

function CodeForm({ factorId, label }: { factorId: string; label: string }) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifyCode, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="factor_id" value={factorId} />
      <label className="block text-sm font-medium text-ink">
        {label}
        <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" autoFocus placeholder="••••••" className={codeInput} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">{pending && <Loader2 className="h-4 w-4 animate-spin" />} Verify</Button>
    </form>
  );
}

/** First time only: add Farmacia Tech to an authenticator app. */
export function EnrollStep() {
  const [enroll, setEnroll] = useState<EnrollState>({});
  const [starting, start] = useTransition();
  if (!enroll.factorId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or similar). You&apos;ll scan a QR code once,
          then enter its 6-digit code every time you open admin.
        </p>
        {enroll.error && <p role="alert" className="text-sm text-red-600">{enroll.error}</p>}
        <Button type="button" disabled={starting} onClick={() => start(async () => setEnroll(await startEnroll()))} className="w-full">
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} Set up authenticator app
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">In the app, add an account and scan this code. Don&apos;t share or screenshot it.</p>
      {/* SVG data URL from Supabase; next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={enroll.qr} alt="QR code for your authenticator app" className="mx-auto h-48 w-48 rounded-xl bg-white p-2 ring-1 ring-line" />
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-brand-600">Can&apos;t scan? Enter the key instead</summary>
        <code className="mt-2 block break-all rounded-lg bg-surface p-3 font-mono text-xs text-ink">{enroll.secret}</code>
      </details>
      <CodeForm factorId={enroll.factorId} label="Then enter the 6-digit code the app shows" />
    </div>
  );
}

export function CodeStep({ factorId }: { factorId: string }) {
  return <CodeForm factorId={factorId} label="6-digit code from your authenticator app" />;
}

export function SetPinStep() {
  const [state, action, pending] = useActionState<VerifyState, FormData>(setPin, {});
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">Choose an admin PIN (6 to 32 characters) that only you know. You&apos;ll enter it every 30 minutes on the admin side.</p>
      <label className="block text-sm font-medium text-ink">
        New PIN
        <input name="pin" type="password" required minLength={6} maxLength={32} autoComplete="new-password" className={inputClass} />
      </label>
      <label className="block text-sm font-medium text-ink">
        Type it again
        <input name="confirm" type="password" required minLength={6} maxLength={32} autoComplete="new-password" className={inputClass} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Save PIN and open admin</Button>
    </form>
  );
}

export function PinStep({ lockedUntil }: { lockedUntil: string | null }) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(unlockAdmin, {});
  return (
    <form action={action} className="space-y-4">
      {lockedUntil && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Too many wrong PINs. Try again after {new Date(lockedUntil).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.
        </p>
      )}
      <label className="block text-sm font-medium text-ink">
        Admin PIN
        <input name="pin" type="password" required maxLength={32} autoComplete="current-password" autoFocus className={inputClass} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Open admin</Button>
    </form>
  );
}
