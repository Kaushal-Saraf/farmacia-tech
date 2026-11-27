import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { getAdminStatus, getSide, requireViewer } from "@/lib/auth";
import { Card } from "../../ui";
import { CodeStep, EnrollStep } from "./VerifySteps";

export const metadata: Metadata = { title: "Admin verification" };

/** Admin needs two factors: the code sent to the admin email (done at sign-in) and the authenticator app. */
export default async function AdminVerifyPage() {
  const { supabase } = await requireViewer(["admin"]);
  if ((await getSide()) !== "admin") redirect("/app");
  const status = await getAdminStatus();
  if (status?.verified) redirect("/app/admin");

  const [{ data: factors }, { data: aal }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const totp = factors?.totp?.[0];
  const steps = ["Email code", "Authenticator app"];

  // The app code was accepted (session at aal2) but the database still says "not verified":
  // show both sides so the cause is visible instead of silently asking for the code again.
  const accepted = aal?.currentLevel === "aal2";
  const totpAt = (aal?.currentAuthenticationMethods ?? [])
    .map((m) => (typeof m === "string" ? { method: m, timestamp: 0 } : m))
    .find((m) => m.method === "totp")?.timestamp;
  const reason = !accepted
    ? null
    : status?.aal !== "aal2"
      ? "The database is not receiving your signed-in session. This happens when the website uses the Supabase secret key: in Vercel set NEXT_PUBLIC_SUPABASE_ANON_KEY to the publishable key (sb_publishable_…) and redeploy."
      : !status?.has_role
        ? "This account doesn't have the admin role in the database. Run modules/1-accounts/database.sql again."
        : "The database didn't accept the authenticator check. Enter a fresh code below.";

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-8">
        <span className="brand-gradient grid h-12 w-12 place-items-center rounded-xl text-white"><ShieldCheck className="h-6 w-6" /></span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">Admin verification</h1>
        <p className="mt-1 text-sm text-muted">Step 2 of 2. The authenticator app is asked at every admin sign-in and again every 12 hours.</p>
        <ol className="mt-6 flex gap-2 text-xs font-semibold">
          {steps.map((label, i) => (
            <li
              key={label}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-center ${
                i === 0 ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
              }`}
            >
              {i === 0 && <Check className="h-3.5 w-3.5" />} {label}
            </li>
          ))}
        </ol>
        {reason && (
          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
            <p className="font-semibold">Your app code was accepted, but admin didn&apos;t open.</p>
            <p className="mt-1">{reason}</p>
            <p className="mt-2 font-mono text-xs text-amber-800">
              session: {aal?.currentLevel ?? "?"}{totpAt ? ` (app code at ${new Date(totpAt * 1000).toLocaleTimeString("en-IN")})` : ""} ·
              database: role {status?.has_role ? "admin" : "not admin"}, sees {status?.aal ?? "no session"}
            </p>
          </div>
        )}
        <div className="mt-6">{totp ? <CodeStep factorId={totp.id} /> : <EnrollStep />}</div>
      </Card>
      <p className="mt-4 text-center text-xs text-muted">
        Lost the phone with the authenticator app? In Supabase → Authentication → Users, open the admin user and remove its MFA factor, then set it up again here.
      </p>
    </div>
  );
}
