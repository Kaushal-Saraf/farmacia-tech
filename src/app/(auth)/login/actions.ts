"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalisePhone, safeNext } from "@/lib/auth";

export type AuthState = { error?: string };

export async function sendOtp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const phone = normalisePhone(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "Enter a valid 10-digit Indian mobile number." };
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) return { error: "We couldn't send the code. Please try again in a minute." };

  redirect(`/login/verify?phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}`);
}

export async function verifyOtp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const phone = normalisePhone(String(formData.get("phone") ?? ""));
  const token = String(formData.get("otp") ?? "").replace(/\D/g, "");
  if (!phone) return { error: "Your phone number is missing. Please start again." };
  if (token.length !== 6) return { error: "Enter the 6-digit code." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) return { error: "That code is wrong or has expired." };

  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
