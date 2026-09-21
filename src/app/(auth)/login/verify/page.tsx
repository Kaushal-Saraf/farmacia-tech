import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { normalisePhone, safeNext } from "@/lib/auth";
import { OtpForm } from "./OtpForm";

export const metadata: Metadata = { title: "Enter code" };

export default async function VerifyPage({ searchParams }: PageProps<"/login/verify">) {
  const { phone, next } = await searchParams;
  const normalised = typeof phone === "string" ? normalisePhone(phone) : null;
  if (!normalised) redirect("/login");

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Enter the code</h1>
      <p className="mt-2 text-sm text-muted">
        We sent a 6-digit code to <span className="font-semibold text-ink">{normalised}</span>.{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">Change number</Link>
      </p>
      <div className="mt-8">
        <OtpForm phone={normalised} next={safeNext(next)} />
      </div>
    </>
  );
}
