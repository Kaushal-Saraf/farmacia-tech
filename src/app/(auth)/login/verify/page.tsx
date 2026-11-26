import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { normalisePhone, safeNext } from "@/lib/auth";
import { isLoginRole, loginRoles } from "../roles";
import { OtpForm } from "./OtpForm";

export const metadata: Metadata = { title: "Enter code" };

export default async function VerifyPage({ searchParams }: PageProps<"/login/verify">) {
  const { phone, next, role } = await searchParams;
  const normalised = typeof phone === "string" ? normalisePhone(phone) : null;
  const back = isLoginRole(role) ? `/login/${role}` : "/login";
  if (!normalised) redirect(back);

  return (
    <>
      {isLoginRole(role) && (
        <p className="text-xs font-bold uppercase tracking-wider text-brand-500">{loginRoles[role].title}</p>
      )}
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Enter the code</h1>
      <p className="mt-2 text-sm text-muted">
        We sent a 6-digit code to <span className="font-semibold text-ink">{normalised}</span>.{" "}
        <Link href={back} className="font-semibold text-brand-600 hover:underline">Change number</Link>
      </p>
      <div className="mt-8">
        <OtpForm phone={normalised} next={safeNext(next)} role={isLoginRole(role) ? role : undefined} />
      </div>
    </>
  );
}
