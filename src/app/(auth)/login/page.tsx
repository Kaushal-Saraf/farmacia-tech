import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNext } from "@/lib/auth";
import { SetupNotice } from "@/components/SetupNotice";
import { PhoneForm } from "./PhoneForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-muted">
        Patients, doctors and partners all sign in with their mobile number. We'll send a one-time code.
      </p>
      <div className="mt-8">{isSupabaseConfigured ? <PhoneForm next={safeNext(next)} /> : <SetupNotice />}</div>
    </>
  );
}
