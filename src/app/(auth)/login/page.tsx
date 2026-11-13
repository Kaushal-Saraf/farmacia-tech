import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { safeNext } from "@/lib/auth";
import { loginRoles, type LoginRole } from "./roles";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  const query = next !== "/app" ? `?next=${encodeURIComponent(next)}` : "";

  // Sent here from a role-specific page? Skip the question.
  if (next.startsWith("/app/doctor")) redirect(`/login/doctor${query}`);
  if (next.startsWith("/app/vendor")) redirect(`/login/vendor${query}`);
  if (next.startsWith("/app/patient")) redirect(`/login/patient${query}`);

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Sign in to Farmacia Tech</h1>
      <p className="mt-2 text-sm text-muted">Choose how you use Farmacia Tech.</p>
      <ul className="mt-8 space-y-3">
        {(Object.keys(loginRoles) as LoginRole[]).map((role) => {
          const r = loginRoles[role];
          return (
            <li key={role}>
              <Link
                href={`/login/${role}${query}`}
                className="group flex items-center gap-4 rounded-2xl p-4 ring-1 ring-line transition hover:bg-brand-50/60 hover:ring-brand-300"
              >
                <span className="brand-gradient grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white">
                  <r.icon className="h-6 w-6" />
                </span>
                <span className="flex-1">
                  <span className="block font-bold text-ink">I&apos;m a {r.label.toLowerCase()}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-muted">{r.pitch}</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-brand-400 transition-transform group-hover:translate-x-1" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
