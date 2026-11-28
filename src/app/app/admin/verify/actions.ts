"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { SIDE_COOKIE } from "@/lib/side";

export type VerifyState = { error?: string; ok?: boolean };
export type EnrollState = { error?: string; factorId?: string; qr?: string; secret?: string };

/** First time: add an authenticator app (shows a QR code once). */
export async function startEnroll(): Promise<EnrollState> {
  const { supabase } = await requireViewer(["admin"]);
  // Clear half-finished setups so they don't pile up.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Farmacia Tech admin ${new Date().toISOString().slice(0, 16)}`,
    issuer: "Farmacia Tech",
  });
  if (error || !data) {
    console.error("[admin sign-in] authenticator setup failed:", error?.status, error?.code ?? "", error?.message);
    return { error: "Couldn't start the setup. Check that TOTP multi-factor is enabled in Supabase." };
  }
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** The 6-digit code from the authenticator app. Raises this session to aal2. */
export async function verifyCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const { supabase } = await requireViewer(["admin"]);
  const factorId = String(formData.get("factor_id") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!factorId) return { error: "Start again." };
  if (code.length !== 6) return { error: "Enter the 6-digit code from your authenticator app." };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    console.error("[admin sign-in] authenticator code failed:", error.status, error.code ?? "", error.message);
    return { error: "That code is wrong or has expired. Codes change every 30 seconds." };
  }
  await supabase.rpc("admin_note_verified");
  // No server redirect here: the browser must load admin with the new (verified) session cookies,
  // so the form does a full page load once it sees ok.
  return { ok: true };
}

/** Sign out of admin (and the whole session). */
export async function lockAdmin() {
  const { supabase } = await requireViewer();
  await supabase.auth.signOut();
  (await cookies()).delete(SIDE_COOKIE);
  redirect("/login/admin");
}
