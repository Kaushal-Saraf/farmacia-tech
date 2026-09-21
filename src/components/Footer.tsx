import Link from "next/link";
import { Logo } from "./Logo";
import { site } from "@/lib/site";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/machine", label: "The machine" },
      { href: "/locations", label: "Find a machine" },
      { href: "/for-clinics", label: "For clinics & pharmacies" },
      { href: "/for-doctors", label: "For doctors" },
      { href: "/login", label: "Patient sign in" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/updates", label: "Updates" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-brand-950 text-brand-100">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-200/80">{site.description}</p>
          <p className="mt-4 text-sm text-brand-200/80">{site.location}</p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-white">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-brand-200/80 hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-brand-200/70 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {site.name}. All rights reserved.</p>
          <div className="flex gap-4">
            <a href={site.social.linkedin} className="hover:text-white" target="_blank" rel="noreferrer">LinkedIn</a>
            <a href={site.social.github} className="hover:text-white" target="_blank" rel="noreferrer">GitHub</a>
            <a href={`mailto:${site.email}`} className="hover:text-white">Email</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
