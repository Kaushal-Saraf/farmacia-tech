"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { ButtonLink } from "./Button";
import { nav } from "@/lib/site";

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Farmacia Tech home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === item.href ? "text-brand-600" : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink href="/login" variant="ghost" className="px-4 py-2.5">
            Sign in
          </ButtonLink>
          <ButtonLink href="/contact" className="px-4 py-2.5">
            Request a demo
          </ButtonLink>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-ink md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-white md:hidden">
          <nav className="container-page flex flex-col py-3" aria-label="Mobile">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-base font-medium text-ink hover:bg-brand-50"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2 pb-2">
              <ButtonLink href="/login" variant="secondary" onClick={() => setOpen(false)}>
                Sign in
              </ButtonLink>
              <ButtonLink href="/contact" onClick={() => setOpen(false)}>
                Request a demo
              </ButtonLink>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
