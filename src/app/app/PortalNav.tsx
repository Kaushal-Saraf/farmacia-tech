"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";

const links: { href: string; label: string; roles: Role[] }[] = [
  { href: "/app/patient", label: "My prescriptions", roles: ["patient", "doctor", "vendor", "admin"] },
  { href: "/app/doctor", label: "Doctor", roles: ["patient", "doctor", "admin"] },
  { href: "/app/vendor", label: "Machines", roles: ["vendor", "admin"] },
  { href: "/app/admin", label: "Admin", roles: ["admin"] },
];

export function PortalNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav className="container-page -mb-px flex gap-1 overflow-x-auto" aria-label="Portal">
      {links
        .filter((l) => l.roles.includes(role))
        .map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${
                active ? "border-brand-500 text-brand-700" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {l.label === "Doctor" && role === "patient" ? "Are you a doctor?" : l.label}
            </Link>
          );
        })}
    </nav>
  );
}
