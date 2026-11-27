import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminCodeForm } from "../AdminEmailForms";

export const metadata: Metadata = { title: "Admin code" };

export default async function AdminVerifyCodePage({ searchParams }: PageProps<"/login/admin/verify">) {
  const { email } = await searchParams;
  if (typeof email !== "string" || !email.includes("@")) redirect("/login/admin");
  return (
    <>
      <p className="text-xs font-bold uppercase tracking-wider text-brand-500">Admin sign in · step 1 of 2</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Check your email</h1>
      <p className="mt-2 text-sm text-muted">
        Supabase accepted the request and sent a code to <span className="font-semibold text-ink">{email}</span>. It can take a minute; check spam too.{" "}
        <Link href="/login/admin" className="font-semibold text-brand-600 hover:underline">Use another email</Link>
      </p>
      <div className="mt-8"><AdminCodeForm email={email} /></div>
    </>
  );
}
