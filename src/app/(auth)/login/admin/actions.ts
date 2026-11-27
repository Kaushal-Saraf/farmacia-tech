"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SIDE_COOKIE, SIDE_COOKIE_OPTIONS } from "@/lib/side";

export type AdminAuthState = { error?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Step 1: send a one-time code to the admin email. Never creates an account. */
export async function sendAdminCode(_prev: AdminAuthState, formData: FormData): Promise<AdminAuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: "Enter the admin email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  // Too many requests is worth saying; anything else (e.g. unknown email) gets the same next screen,
  // so the page doesn't reveal which emails are admin accounts.
  if (error?.status === 429) return { error: "Too many codes requested. Wait a few minutes and try again." };
  redirect(`/login/admin/verify?email=${encodeURIComponent(email)}`);
}

/** Step 2: the emailed code. Only admin accounts may continue; the authenticator app comes next. */
export async function verifyAdminCode(_prev: AdminAuthState, formData: FormData): Promise<AdminAuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!EMAIL.test(email)) return { error: "Start again." };
  if (token.length < 6 || token.length > 10) return { error: "Enter the code from the email." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) return { error: "That code is wrong or has expired." };

  const { data: profile } = await supabase.from("profiles").select("roles").eq("id", data.user.id).maybeSingle();
  if (!(profile?.roles as string[] | undefined)?.includes("admin")) {
    await supabase.auth.signOut();
    return { error: "This email isn't set up as admin yet. In Supabase, run supabase/roles.sql again (after creating this user), then try again." };
  }
  (await cookies()).set(SIDE_COOKIE, "admin", SIDE_COOKIE_OPTIONS);
  redirect("/app/admin/verify");
}
