import type { Metadata } from "next";
import { Mail, MapPin } from "lucide-react";
import { site } from "@/lib/site";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Request a demo, partner with Farmacia Tech, or ask us anything.",
};

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const { type } = await searchParams;
  return (
    <section className="bg-surface">
      <div className="container-page grid gap-12 py-16 sm:py-24 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-500">Contact</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl text-balance">
            Let's talk about your site.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted text-pretty">
            Want a demo, a pilot at your hospital or campus, or just to learn more? Send us a note.
          </p>
          <ul className="mt-10 space-y-5">
            <li className="flex gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-line">
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Email</p>
                <a href={`mailto:${site.email}`} className="text-sm text-brand-600 hover:underline">{site.email}</a>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-line">
                <MapPin className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Based in</p>
                <p className="text-sm text-muted">{site.location}</p>
              </div>
            </li>
          </ul>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line sm:p-10">
          <ContactForm defaultType={typeof type === "string" ? type : "partner"} />
        </div>
      </div>
    </section>
  );
}
