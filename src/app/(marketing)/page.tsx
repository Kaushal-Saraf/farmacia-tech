import { ArrowRight, Building2, Stethoscope, User } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { MachineIllustration } from "@/components/MachineIllustration";
import { SectionHeading } from "@/components/Section";
import { features, steps, trust } from "@/lib/content";
import { CtaBand } from "./CtaBand";

const audiences = [
  {
    icon: User,
    title: "Patients",
    body: "Get your prescription on your phone, pay online, and collect medicines from a nearby machine whenever it suits you.",
    href: "/login",
    cta: "Patient sign in",
  },
  {
    icon: Stethoscope,
    title: "Doctors",
    body: "Write clear digital prescriptions in seconds. Your patients can fill them 24×7 without hunting for an open pharmacy.",
    href: "/for-doctors",
    cta: "For doctors",
  },
  {
    icon: Building2,
    title: "Clinics & pharmacies",
    body: "Extend your pharmacy beyond counter hours with a machine that tracks its own stock, sales and expiry dates.",
    href: "/for-clinics",
    cta: "Partner with us",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-surface">
        <div className="pointer-events-none absolute -top-48 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="container-page relative grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              AI + robotics for pharmacy access
            </span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl text-balance">
              Prescription medicines, <span className="text-brand-500">dispensed safely</span> — any time.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted text-pretty">
              Farmacia Tech connects doctors, patients and smart vending machines. A doctor prescribes online,
              the patient pays on their phone, and our AI-guided machine hands over exactly the right medicines.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/contact">
                Request a demo <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/how-it-works" variant="secondary">
                How it works
              </ButtonLink>
            </div>
          </div>
          <MachineIllustration />
        </div>
      </section>

      {/* How it works */}
      <section className="container-page py-20 sm:py-28">
        <SectionHeading
          eyebrow="How it works"
          title="From prescription to pickup in four steps"
          intro="No queues, no paper slips, and no chance of the wrong medicine. Each step is checked digitally before anything is dispensed."
        />
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-line bg-white p-6 shadow-card">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="text-4xl font-extrabold text-brand-100">0{i + 1}</span>
              </div>
              <h3 className="mt-5 font-bold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Audiences */}
      <section className="bg-surface py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading
            eyebrow="Who it's for"
            title="One platform, three sides of the counter"
            center
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {audiences.map((a) => (
              <div key={a.title} className="flex flex-col rounded-2xl bg-white p-7 shadow-card ring-1 ring-line">
                <span className="brand-gradient grid h-12 w-12 place-items-center rounded-xl text-white">
                  <a.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-ink">{a.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{a.body}</p>
                <Link
                  href={a.href}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-800"
                >
                  {a.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container-page py-20 sm:py-28">
        <SectionHeading
          eyebrow="The machine"
          title="Robotics that pharmacists can trust"
          intro="Each Farmacia Tech machine combines computer vision, adaptive grasping and a secure cloud platform, so it never guesses."
        />
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-bold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="bg-brand-950 py-20 sm:py-24">
        <div className="container-page">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-300">Safety & privacy</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl text-balance">
              Health data deserves more than a login screen
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {trust.map((t) => (
              <div key={t.title} className="rounded-2xl bg-white/5 p-7 ring-1 ring-white/10">
                <t.icon className="h-6 w-6 text-brand-300" />
                <h3 className="mt-4 font-bold text-white">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-100/80">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
