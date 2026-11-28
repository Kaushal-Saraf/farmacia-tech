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
  if (error) {
    // Details go to Vercel → Logs only. The page shows a short message (and a code from
    // modules/2-admin/README.md → Troubleshooting); setup steps are never shown on the site.
    console.error("[admin sign-in] send code failed:", error.status, error.code ?? "", error.message);
    if (error.status === 429 || /security purposes|rate limit/i.test(error.message)) {
      return { error: "Too many codes requested. Wait a minute and try again." };
    }
    if (error.code === "otp_disabled" || /signups not allowed|user not found/i.test(error.message)) {
      return { error: "This email isn't an admin account." };
    }
    return { error: "We couldn't send the code. Please try again in a few minutes. (ADM-EMAIL)" };
  }
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
  if (error || !data.user) {
    console.error("[admin sign-in] code check failed:", error?.status, error?.code ?? "", error?.message);
    return { error: "That code is wrong or has expired." };
  }

  const { data: profile } = await supabase.from("profiles").select("roles").eq("id", data.user.id).maybeSingle();
  if (!(profile?.roles as string[] | undefined)?.includes("admin")) {
    console.error("[admin sign-in] signed in but not admin (re-run modules/1-accounts/database.sql?)");
    await supabase.auth.signOut();
    return { error: "This email isn't an admin account. (ADM-ROLE)" };
  }
  (await cookies()).set(SIDE_COOKIE, "admin", SIDE_COOKIE_OPTIONS);
  redirect("/app/admin/verify");
}
