"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Side } from "@/lib/side";

type Tab = { href: string; label: string };

/** Only the current side's tabs are shown. */
function tabsFor(side: Side, isDoctor: boolean, isVendor: boolean): Tab[] {
  switch (side) {
    case "patient":
      return [
        { href: "/app/patient", label: "My prescriptions" },
        { href: "/app/patient/family", label: "My family" },
      ];
    case "doctor":
      return isDoctor
        ? [
            { href: "/app/doctor", label: "Prescriptions issued" },
            { href: "/app/doctor/new", label: "New prescription" },
          ]
        : [{ href: "/app/doctor", label: "Doctor verification" }];
    case "vendor":
      return isVendor
        ? [
            { href: "/app/vendor", label: "My devices" },
            { href: "/app/vendor/stock", label: "Stock" },
          ]
        : [{ href: "/app/vendor", label: "Link a device" }];
    case "admin":
      return [
        { href: "/app/admin", label: "Admin" },
        { href: "/app/vendor", label: "Devices" },
        { href: "/app/vendor/stock", label: "Stock" },
      ];
  }
}

export function PortalNav({ side, isDoctor, isVendor }: { side: Side; isDoctor: boolean; isVendor: boolean }) {
  const pathname = usePathname();
  const tabs = tabsFor(side, isDoctor, isVendor);
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
