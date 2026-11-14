"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";

type Tab = { href: string; label: string };

/** Each kind of account only sees its own tabs. */
function tabsFor(role: Role, doctorApplicant: boolean): Tab[] {
  switch (role) {
    case "patient":
      return doctorApplicant
        ? [{ href: "/app/doctor", label: "Doctor verification" }]
        : [
            { href: "/app/patient", label: "My prescriptions" },
            { href: "/app/patient/family", label: "My family" },
          ];
    case "doctor":
      return [
        { href: "/app/doctor", label: "Prescriptions issued" },
        { href: "/app/doctor/new", label: "New prescription" },
      ];
    case "vendor":
      return [
        { href: "/app/vendor", label: "My devices" },
        { href: "/app/vendor/stock", label: "Stock" },
      ];
    case "admin":
      return [
        { href: "/app/admin", label: "Admin" },
        { href: "/app/vendor", label: "Devices" },
        { href: "/app/vendor/stock", label: "Stock" },
      ];
  }
}

export function PortalNav({ role, doctorApplicant }: { role: Role; doctorApplicant: boolean }) {
  const pathname = usePathname();
  const tabs = tabsFor(role, doctorApplicant);
  // Most specific match wins, so "New prescription" doesn't also light up "Prescriptions issued".
  const active = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="container-page -mb-px flex gap-1 overflow-x-auto" aria-label="Portal">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${
            t.href === active ? "border-brand-500 text-brand-700" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
