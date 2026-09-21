import type { Metadata } from "next";
import { Cpu, HeartPulse, Target } from "lucide-react";
import { PageHero, SectionHeading } from "@/components/Section";
import { site } from "@/lib/site";
import { CtaBand } from "../CtaBand";

export const metadata: Metadata = {
  title: "About",
  description: "Why we're building Farmacia Tech: safe, round-the-clock access to prescription medicines.",
};

const values = [
  { icon: HeartPulse, title: "Patients first", body: "Access to medicine shouldn't depend on whether a counter is open. We design for the patient at 2 a.m." },
  { icon: Target, title: "Safety over speed", body: "Every dispense is checked against a verified prescription. If anything doesn't match, the machine doesn't move." },
  { icon: Cpu, title: "Engineered end to end", body: "We build the electronics, the robotics and the software ourselves, so each layer is designed to work with the others." },
];

const milestones = [
  { label: "Research", body: "Studied gaps in after-hours pharmacy access and prescription handling." },
  { label: "Prototype", body: "Built a working machine with an ESP32 QR scanner, motorised slots and a web platform for doctors, patients and vendors." },
  { label: "Now", body: "Rebuilding the platform for security and scale, adding vision-guided picking and preparing for pilot sites." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About us"
        title="We're making prescription medicines available around the clock, safely."
        intro={`${site.name} started as an engineering project with a simple question: why does getting prescribed medicine stop when the pharmacy closes? We're answering it with robotics, computer vision and a secure e-prescription platform.`}
      />

      <section className="container-page py-20">
        <SectionHeading eyebrow="What we believe" title="Three principles behind every machine" />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {values.map((v) => (
            <div key={v.title} className="rounded-2xl border border-line bg-white p-7 shadow-card">
              <v.icon className="h-7 w-7 text-brand-500" />
              <h3 className="mt-4 font-bold text-ink">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface py-20">
        <div className="container-page grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Our journey" title="From a prototype to a platform" />
            <ol className="mt-10 space-y-6 border-l-2 border-brand-100 pl-6">
              {milestones.map((m) => (
                <li key={m.label} className="relative">
                  <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-500" />
                  <p className="text-sm font-bold text-brand-600">{m.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{m.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <SectionHeading eyebrow="Team" title="The people building it" />
            <div className="mt-10 flex items-start gap-5 rounded-2xl bg-white p-6 ring-1 ring-line">
              <span className="brand-gradient grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-extrabold text-white">
                KS
              </span>
              <div>
                <p className="font-bold text-ink">Kaushal Saraf</p>
                <p className="text-sm font-medium text-brand-600">Founder</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Electronics & communication engineer working on robotics, embedded systems and intelligent machines.
                </p>
                <a href={site.social.linkedin} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline">
                  LinkedIn →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
