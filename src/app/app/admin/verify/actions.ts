"use server";

import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";

export type VerifyState = { error?: string };
export type EnrollState = { error?: string; factorId?: string; qr?: string; secret?: string };

/** Step 2 setup: add an authenticator app (shows a QR code once). */
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
  if (error || !data) return { error: "Couldn't start the setup. Check that TOTP multi-factor is enabled in Supabase." };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Step 2: the 6-digit code from the authenticator app. Raises this session to aal2. */
export async function verifyCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const { supabase } = await requireViewer(["admin"]);
  const factorId = String(formData.get("factor_id") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!factorId) return { error: "Start again." };
  if (code.length !== 6) return { error: "Enter the 6-digit code from your authenticator app." };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: "That code is wrong or has expired. Codes change every 30 seconds." };
  redirect("/app/admin/verify");
}

/** Step 3 (first time): choose the admin PIN. */
export async function setPin(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const { supabase } = await requireViewer(["admin"]);
  const pin = String(formData.get("pin") ?? "");
  if (pin !== String(formData.get("confirm") ?? "")) return { error: "The two PINs don't match." };
  if (pin.length < 6 || pin.length > 32) return { error: "The PIN must be 6 to 32 characters." };
  if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) {
    return { error: "Choose a PIN that is harder to guess." };
  }
  const { data, error } = await supabase.rpc("admin_set_pin", { p_new: pin });
  if (error || (data as { error?: string })?.error) return { error: (data as { error?: string })?.error ?? "Couldn't save the PIN." };
  redirect("/app/admin");
}

/** Step 3: the admin PIN. Unlocks admin for 30 minutes on this session. */
export async function unlockAdmin(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const { supabase } = await requireViewer(["admin"]);
  const { data, error } = await supabase.rpc("admin_unlock", { p_pin: String(formData.get("pin") ?? "") });
  const res = data as { ok?: boolean; error?: string } | null;
  if (error || !res?.ok) return { error: res?.error ?? "Couldn't check the PIN. Please try again." };
  redirect("/app/admin");
}

export async function lockAdmin() {
  const { supabase } = await requireViewer(["admin"]);
  await supabase.rpc("admin_lock");
  redirect("/app/admin/verify");
}
