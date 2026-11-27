import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/SetupNotice";
import { AdminEmailForm } from "./AdminEmailForms";

export const metadata: Metadata = { title: "Admin sign in" };

/** Admin signs in with email (never a mobile number): a code by email, then the authenticator app. */
export default function AdminLoginPage() {
  return (
    <>
      <Link href="/login" className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Not an admin?
      </Link>
      <div className="mt-5 flex items-center gap-3">
        <span className="brand-gradient grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white"><ShieldCheck className="h-5 w-5" /></span>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Admin sign in</h1>
      </div>
      <p className="mt-3 text-sm text-muted">For Farmacia Tech staff. Two steps: a code sent to the admin email, then the code from your authenticator app.</p>
      <div className="mt-8">{isSupabaseConfigured ? <AdminEmailForm /> : <SetupNotice />}</div>
    </>
  );
}
