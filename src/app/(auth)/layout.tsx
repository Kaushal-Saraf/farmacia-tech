import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-surface px-4 py-16">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-brand-200/50 blur-3xl" />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center" aria-label="Back to home">
          <Logo />
        </Link>
        <div className="rounded-3xl bg-white p-8 shadow-card ring-1 ring-line">{children}</div>
        <p className="mt-6 text-center text-xs text-muted">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline">Terms</Link> and{" "}
          <Link href="/privacy" className="underline">Privacy policy</Link>.
        </p>
      </div>
    </main>
  );
}
