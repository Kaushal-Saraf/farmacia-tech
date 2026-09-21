import type { Metadata } from "next";
import { PageHero } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { updates } from "@/lib/updates";

export const metadata: Metadata = {
  title: "Updates",
  description: "News and milestones from Farmacia Tech.",
};

export default function UpdatesPage() {
  return (
    <>
      <PageHero eyebrow="Updates" title="News & milestones" intro="What we've shipped, what we're testing and where we're headed." />
      <section className="container-page max-w-3xl py-16">
        <ol className="relative space-y-8 border-l-2 border-brand-100 pl-8">
          {updates.map((u, i) => (
            <Reveal as="li" key={u.title} delay={i * 80} className="relative">
              <span className="absolute -left-[41px] top-2 h-4 w-4 rounded-full border-4 border-white bg-brand-500 shadow" />
              <p className="text-xs font-semibold text-brand-600">
                <span className="rounded-full bg-brand-50 px-2 py-0.5 ring-1 ring-brand-100">{u.tag}</span> · {u.date}
              </p>
              <h2 className="mt-3 text-xl font-bold text-ink">{u.title}</h2>
              <p className="mt-2 leading-relaxed text-muted">{u.body}</p>
            </Reveal>
          ))}
        </ol>
      </section>
    </>
  );
}
