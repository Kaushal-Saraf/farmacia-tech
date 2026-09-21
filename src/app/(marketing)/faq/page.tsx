import type { Metadata } from "next";
import { FaqList } from "@/components/FaqList";
import { PageHero } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { faqs, type Faq } from "@/lib/faq";
import { CtaBand } from "../CtaBand";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers for patients, doctors and partners about Farmacia Tech medicine vending machines.",
};

const groups: Faq["group"][] = ["Patients", "Doctors", "Partners", "Safety"];

export default function FaqPage() {
  return (
    <>
      <PageHero eyebrow="FAQ" title="Frequently asked questions" intro="Can't find what you're looking for? Send us a message and we'll reply within two working days." />
      <section className="container-page grid gap-12 py-16 lg:grid-cols-[200px_1fr]">
        <nav className="hidden lg:block" aria-label="FAQ sections">
          <ul className="sticky top-24 space-y-1 text-sm">
            {groups.map((g) => (
              <li key={g}>
                <a href={`#${g.toLowerCase()}`} className="block rounded-lg px-3 py-2 font-medium text-muted hover:bg-brand-50 hover:text-brand-700">{g}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-12">
          {groups.map((g) => (
            <Reveal key={g}>
              <section id={g.toLowerCase()} className="scroll-mt-24">
                <h2 className="mb-4 text-xl font-bold text-ink">{g}</h2>
                <FaqList items={faqs.filter((f) => f.group === g)} />
              </section>
            </Reveal>
          ))}
        </div>
      </section>
      <CtaBand title="Still have a question?" body="Write to us and a real person will get back to you." />
    </>
  );
}
