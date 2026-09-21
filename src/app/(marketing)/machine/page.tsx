import type { Metadata } from "next";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/Button";
import { MachineIllustration } from "@/components/MachineIllustration";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/Section";
import { features } from "@/lib/content";
import { installSteps, machineSpecs } from "@/lib/machine";
import { CtaBand } from "../CtaBand";

export const metadata: Metadata = {
  title: "The machine",
  description: "Inside the Farmacia Tech medicine vending machine: vision-guided picking, adaptive grasping, secure QR pickup and live inventory.",
};

export default function MachinePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-surface">
        <div className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-brand-200/50 blur-3xl" />
        <div className="container-page relative grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2">
          <div className="animate-fade-up">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-500">The machine</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl text-balance">
              A pharmacy counter that never closes
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted text-pretty">
              Designed and built in-house, from the electronics to the gripper to the cloud. Every part exists to make one thing
              reliable: the right medicine, to the right person, every time.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/contact?type=partner">Get a machine for your site</ButtonLink>
              <ButtonLink href="/locations" variant="secondary">Find a machine</ButtonLink>
            </div>
          </div>
          <MachineIllustration />
        </div>
      </section>

      <section className="container-page py-20">
        <Reveal>
          <SectionHeading eyebrow="Capabilities" title="What's inside" />
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 100} className="h-full">
              <div className="h-full rounded-2xl border border-line bg-white p-6 shadow-card">
                <f.icon className="h-6 w-6 text-brand-500" />
                <h3 className="mt-4 font-bold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-surface py-20">
        <div className="container-page grid gap-12 lg:grid-cols-2">
          <div>
            <Reveal>
              <SectionHeading eyebrow="Specifications" title="Built for real-world sites" />
            </Reveal>
            <Reveal delay={100}>
              <dl className="mt-8 divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                {machineSpecs.map((s) => (
                  <div key={s.label} className="grid grid-cols-[140px_1fr] gap-4 px-5 py-4 text-sm sm:grid-cols-[180px_1fr]">
                    <dt className="font-semibold text-ink">{s.label}</dt>
                    <dd className="text-muted">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
          <div>
            <Reveal>
              <SectionHeading eyebrow="Installation" title="From survey to go-live" />
            </Reveal>
            <ol className="mt-8 space-y-4">
              {installSteps.map((s, i) => (
                <Reveal as="li" key={s.title} delay={i * 80} className="flex gap-4">
                  <span className="brand-gradient grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white">{i + 1}</span>
                  <div>
                    <p className="font-bold text-ink">{s.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
            <ul className="mt-8 grid gap-2 text-sm text-ink sm:grid-cols-2">
              {["Restock via dashboard", "Low-stock alerts", "Expiry tracking", "Remote monitoring"].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-brand-500" /> {t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <CtaBand title="Want a machine at your hospital or campus?" />
    </>
  );
}
