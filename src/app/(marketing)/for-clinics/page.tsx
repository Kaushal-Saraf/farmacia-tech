import type { Metadata } from "next";
import { BarChart3, CalendarClock, Clock, IndianRupee, Wrench, Users } from "lucide-react";
import { PageHero, SectionHeading } from "@/components/Section";
import { ButtonLink } from "@/components/Button";
import { CtaBand } from "../CtaBand";

export const metadata: Metadata = {
  title: "For clinics & pharmacies",
  description: "Extend your pharmacy to 24×7 with a Farmacia Tech smart medicine vending machine: live inventory, expiry tracking and UPI payments.",
};

const benefits = [
  { icon: Clock, title: "Serve patients after hours", body: "Night shifts, weekends and emergencies are covered without extra counter staff." },
  { icon: Users, title: "Shorter pharmacy queues", body: "Routine, pre-paid prescriptions move to the machine, so your pharmacists can focus on counselling." },
  { icon: BarChart3, title: "Stock at a glance", body: "See every slot in every machine from one dashboard, with low-stock alerts before a medicine runs out." },
  { icon: CalendarClock, title: "Expiry handled for you", body: "Batches are tracked by expiry date, and expired stock is automatically blocked from sale." },
  { icon: IndianRupee, title: "Payments reconciled", body: "Every UPI or card payment is matched to a prescription and a dispense event." },
  { icon: Wrench, title: "Installation & support", body: "We handle setup, training and maintenance, so your team only has to restock." },
];

const sites = ["Hospitals & OPDs", "Clinics & polyclinics", "Retail pharmacies", "University campuses", "Corporate offices", "Residential societies"];

export default function ForClinicsPage() {
  return (
    <>
      <PageHero
        eyebrow="For clinics & pharmacies"
        title="Your pharmacy, open around the clock"
        intro="Place a Farmacia Tech machine at your hospital, clinic or pharmacy and let patients collect verified prescriptions at any hour. You stay in control of stock and pricing."
      >
        <ButtonLink href="/contact?type=partner">Become a partner</ButtonLink>
        <ButtonLink href="/how-it-works" variant="secondary">How it works</ButtonLink>
      </PageHero>

      <section className="container-page py-20">
        <SectionHeading eyebrow="Why partner" title="Built for the people who run the pharmacy" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-2xl border border-line bg-white p-6 shadow-card">
              <b.icon className="h-6 w-6 text-brand-500" />
              <h3 className="mt-4 font-bold text-ink">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface py-20">
        <div className="container-page">
          <SectionHeading eyebrow="Where it fits" title="Designed for high-footfall sites" center />
          <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-3">
            {sites.map((s) => (
              <li key={s} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-800 ring-1 ring-brand-100">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand title="Let's find the right spot for your first machine." />
    </>
  );
}
