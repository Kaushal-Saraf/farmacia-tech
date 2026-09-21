import type { Metadata } from "next";
import { BadgeCheck, FileText, History, Smartphone } from "lucide-react";
import { PageHero, SectionHeading } from "@/components/Section";
import { ButtonLink } from "@/components/Button";
import { CtaBand } from "../CtaBand";

export const metadata: Metadata = {
  title: "For doctors",
  description: "Write digital prescriptions your patients can fill 24×7 at a Farmacia Tech machine.",
};

const points = [
  { icon: FileText, title: "Structured prescriptions", body: "Medicines, dosage, frequency and duration, plus tests, injections and advice, in a clear digital format with no handwriting to decipher." },
  { icon: Smartphone, title: "Delivered to the patient's phone", body: "Patients see the prescription as soon as you sign it and can fill it at any machine that has the medicines in stock." },
  { icon: History, title: "Patient history, with consent", body: "See the prescriptions you've issued to a patient over time, so follow-ups are easier." },
  { icon: BadgeCheck, title: "Verified profile", body: "Your medical registration is verified once. Patients see a verified badge on every prescription you issue." },
];

export default function ForDoctorsPage() {
  return (
    <>
      <PageHero
        eyebrow="For doctors"
        title="Prescribe once. Your patient collects anytime."
        intro="Farmacia Tech gives you a fast, verified e-prescription tool. Your patients can fill prescriptions even after the pharmacy has closed."
      >
        <ButtonLink href="/login?next=/app/doctor">Join as a doctor</ButtonLink>
      </PageHero>

      <section className="container-page py-20">
        <SectionHeading eyebrow="What you get" title="Less paperwork, fewer missed doses" />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {points.map((p) => (
            <div key={p.title} className="flex gap-5 rounded-2xl border border-line bg-white p-6 shadow-card">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <p.icon className="h-6 w-6" />
              </span>
              <div>
                <h3 className="font-bold text-ink">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl bg-surface p-8 ring-1 ring-line">
          <h3 className="text-lg font-bold text-ink">How verification works</h3>
          <ol className="mt-4 grid gap-4 text-sm text-muted sm:grid-cols-3">
            <li><span className="font-bold text-brand-600">1.</span> Sign in with your mobile number.</li>
            <li><span className="font-bold text-brand-600">2.</span> Submit your NMC / State Medical Council registration number and degree.</li>
            <li><span className="font-bold text-brand-600">3.</span> Our team verifies your details, then prescribing is unlocked.</li>
          </ol>
        </div>
      </section>

      <CtaBand
        title="Want to bring Farmacia Tech to your clinic?"
        body="If you run a clinic or hospital OPD, we can install a machine on site so your patients can pick up medicines as they leave."
      />
    </>
  );
}
