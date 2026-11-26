import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { getAdminStatus, getSide, requireViewer } from "@/lib/auth";
import { Card } from "../../ui";
import { CodeStep, EnrollStep, PinStep, SetPinStep } from "./VerifySteps";

export const metadata: Metadata = { title: "Admin verification" };

/** The admin side needs three factors: SMS sign-in (done), authenticator app, admin PIN. */
export default async function AdminVerifyPage() {
  const { supabase } = await requireViewer(["admin"]);
  if ((await getSide()) !== "admin") redirect("/app");
  const status = await getAdminStatus();
  if (status?.unlocked_until) redirect("/app/admin");

  const [{ data: aal }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  const totp = factors?.totp?.[0];
  const step = !totp ? "enroll" : aal?.currentLevel !== "aal2" ? "code" : !status?.has_pin ? "set_pin" : "pin";
  const done = { enroll: 1, code: 1, set_pin: 2, pin: 2 }[step];

  const steps = ["SMS code", "Authenticator app", "Admin PIN"];
  return (
    <div className="mx-auto max-w-md">
      <Card className="p-8">
        <span className="brand-gradient grid h-12 w-12 place-items-center rounded-xl text-white"><ShieldCheck className="h-6 w-6" /></span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">Admin verification</h1>
        <p className="mt-1 text-sm text-muted">Admin needs all three checks, every time you sign in. The PIN is asked again every 30 minutes.</p>

        <ol className="mt-6 flex gap-2 text-xs font-semibold">
          {steps.map((label, i) => (
            <li
              key={label}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-center ${
                i < done ? "bg-emerald-50 text-emerald-700" : i === done ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "bg-surface text-muted"
              }`}
            >
              {i < done && <Check className="h-3.5 w-3.5" />} {label}
            </li>
          ))}
        </ol>

        <div className="mt-6">
          {step === "enroll" && <EnrollStep />}
          {step === "code" && totp && <CodeStep factorId={totp.id} />}
          {step === "set_pin" && <SetPinStep />}
          {step === "pin" && <PinStep lockedUntil={status?.locked_until ?? null} />}
        </div>
      </Card>
      <p className="mt-4 text-center text-xs text-muted">
        Lost your phone or authenticator app? Another admin can remove the old app in Supabase → Authentication → Users, then you set it up again.
      </p>
    </div>
  );
}
