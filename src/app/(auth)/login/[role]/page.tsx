import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNext } from "@/lib/auth";
import { SetupNotice } from "@/components/SetupNotice";
import { PhoneForm } from "../PhoneForm";
import { isLoginRole, landingFor, loginRoles } from "../roles";

export async function generateMetadata({ params }: PageProps<"/login/[role]">): Promise<Metadata> {
  const { role } = await params;
  return { title: isLoginRole(role) ? loginRoles[role].title : "Sign in" };
}

export default async function RoleLoginPage({ params, searchParams }: PageProps<"/login/[role]">) {
  const { role } = await params;
  if (!isLoginRole(role)) notFound();
  const r = loginRoles[role];
  const next = landingFor(role, safeNext((await searchParams).next));

  return (
    <>
      <Link href="/login" className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Not a {r.label.toLowerCase()}?
      </Link>
      <div className="mt-5 flex items-center gap-3">
        <span className="brand-gradient grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white">
          <r.icon className="h-5 w-5" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{r.title}</h1>
      </div>
      <p className="mt-3 text-sm text-muted">{r.intro}</p>
      <div className="mt-8">{isSupabaseConfigured ? <PhoneForm role={role} next={next} /> : <SetupNotice />}</div>
    </>
  );
}
