import type { Metadata } from "next";
import { Check } from "lucide-react";
import { PageHero, SectionHeading } from "@/components/Section";
import { ButtonLink } from "@/components/Button";
import { steps } from "@/lib/content";
import { CtaBand } from "../CtaBand";

export const metadata: Metadata = {
  title: "How it works",
  description: "From a doctor's e-prescription to a single-use QR code and automated dispensing — how Farmacia Tech works end to end.",
};

const details = [
  ["Doctor is verified", "Registration number is checked before the account can prescribe.", "Prescription is signed and timestamped; it can't be edited afterwards."],
  ["Stock is checked live", "Only machines with every medicine in stock are shown.", "Packs are reserved the moment payment succeeds, so they can't be sold twice."],
  ["QR is single-use", "Bound to one order and one machine, with an expiry time.", "Contains a random token, never personal or health data."],
  ["Dispense is confirmed", "Vision system confirms each pack before release.", "Stock, sale and pickup are logged automatically for the operator."],
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="Every step verified before a single pack moves"
        intro="Farmacia Tech is a closed loop: the doctor, the patient, the payment and the machine are all checked digitally. That's what makes unattended dispensing of prescription medicines safe."
      >
        <ButtonLink href="/contact">Request a demo</ButtonLink>
      </PageHero>

      <section className="container-page py-20">
        <ol className="relative space-y-6 before:absolute before:left-6 before:top-6 before:bottom-6 before:w-px before:bg-brand-100 sm:before:left-7">
          {steps.map((s, i) => (
            <li key={s.title} className="relative flex gap-5 sm:gap-8">
              <span className="brand-gradient relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white sm:h-14 sm:w-14">
                <s.icon className="h-6 w-6" />
              </span>
              <div className="flex-1 rounded-2xl border border-line bg-white p-6 shadow-card">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-500">Step {i + 1}</p>
                <h2 className="mt-1 text-xl font-bold text-ink">{s.title}</h2>
                <p className="mt-2 text-muted">{s.body}</p>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {details[i].slice(1).map((d) => (
                    <li key={d} className="flex gap-2 text-sm text-ink">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> {d}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-surface py-20">
        <div className="container-page grid gap-10 lg:grid-cols-2 lg:items-center">
          <SectionHeading
            eyebrow="Under the hood"
            title="Hardware and software designed together"
            intro="The machine runs on an embedded controller with a camera module for QR scanning and pack verification. It talks to the Farmacia Tech cloud over an authenticated connection, so a machine only ever dispenses what the platform has approved."
          />
          <dl className="grid grid-cols-2 gap-4">
            {[
              ["Controller", "ESP32-based with authenticated device keys"],
              ["Picking", "Motorised slots + compliant gripper"],
              ["Vision", "QR scanning and pack confirmation"],
              ["Cloud", "Encrypted, hosted in India"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white p-5 ring-1 ring-line">
                <dt className="text-xs font-bold uppercase tracking-wider text-brand-500">{k}</dt>
                <dd className="mt-2 text-sm font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
