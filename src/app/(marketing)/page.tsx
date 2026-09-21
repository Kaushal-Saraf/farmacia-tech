import { ArrowRight, Building2, ShieldCheck, Stethoscope, User } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { DemoWalkthrough } from "@/components/DemoWalkthrough";
import { FaqList } from "@/components/FaqList";
import { MachineIllustration } from "@/components/MachineIllustration";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/Section";
import { features, trust } from "@/lib/content";
import { faqs } from "@/lib/faq";
import { updates } from "@/lib/updates";
import { CtaBand } from "./CtaBand";

const stats = [
  { value: "24×7", label: "Access to prescribed medicines" },
  { value: "4-step", label: "Digital check before every dispense" },
  { value: "1 QR", label: "Single-use code per order" },
  { value: "0", label: "Aadhaar numbers collected" },
];

const sites = ["Hospital OPDs", "Clinics", "Retail pharmacies", "University campuses", "Corporate offices", "Residential societies", "Metro stations", "Industrial parks"];

const audiences = [
  { icon: User, title: "Patients", body: "Get your prescription on your phone, pay online, and collect from a nearby machine whenever it suits you.", href: "/login", cta: "Patient sign in" },
  { icon: Stethoscope, title: "Doctors", body: "Write clear digital prescriptions in seconds. Your patients can fill them 24×7 without hunting for an open pharmacy.", href: "/for-doctors", cta: "For doctors" },
  { icon: Building2, title: "Clinics & pharmacies", body: "Extend your pharmacy beyond counter hours with a machine that tracks its own stock, sales and expiry dates.", href: "/for-clinics", cta: "Partner with us" },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div className="brand-gradient absolute inset-0 opacity-70" />
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-brand-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-[28rem] w-[28rem] rounded-full bg-sky-300/20 blur-3xl" />

        <div className="container-page relative grid items-center gap-14 pb-32 pt-16 sm:pt-24 lg:grid-cols-[1.1fr_1fr] lg:pb-40">
          <div>
            <span className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-brand-100 ring-1 ring-white/20 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-300" />
              </span>
              AI + robotics for pharmacy access
            </span>
            <h1 className="animate-fade-up mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-balance" style={{ animationDelay: "100ms" }}>
              Prescription medicines,{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-brand-200 bg-clip-text text-transparent">dispensed safely</span>{" "}
              — any time.
            </h1>
            <p className="animate-fade-up mt-6 max-w-xl text-lg leading-relaxed text-brand-100/90 text-pretty" style={{ animationDelay: "200ms" }}>
              Farmacia Tech connects doctors, patients and smart vending machines. A doctor prescribes online, the patient
              pays on their phone, and our AI-guided machine hands over exactly the right medicines.
            </p>
            <div className="animate-fade-up mt-8 flex flex-wrap gap-3" style={{ animationDelay: "300ms" }}>
              <ButtonLink href="/contact" variant="white">
                Request a demo <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="#demo" className="bg-white/10 ring-1 ring-inset ring-white/30 hover:bg-white/20">
                See it in action
              </ButtonLink>
            </div>
            <p className="animate-fade-up mt-8 flex items-center gap-2 text-sm text-brand-200" style={{ animationDelay: "400ms" }}>
              <ShieldCheck className="h-4 w-4" /> Verified doctors · Encrypted data stored in India
            </p>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: "250ms" }}>
            <MachineIllustration />
          </div>
        </div>
      </section>

      {/* Stats — overlaps hero */}
      <section className="container-page relative z-10 -mt-20">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-line shadow-card ring-1 ring-line lg:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 100} className="bg-white p-6 sm:p-8">
              <p className="text-3xl font-extrabold tracking-tight text-brand-600 sm:text-4xl">{s.value}</p>
              <p className="mt-2 text-sm text-muted">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Where it fits — marquee */}
      <section className="py-14" aria-label="Where Farmacia Tech fits">
        <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-muted">Built for high-footfall sites</p>
        <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="animate-marquee flex w-max gap-3">
            {[...sites, ...sites].map((s, i) => (
              <span key={i} className="whitespace-nowrap rounded-full bg-surface px-5 py-2.5 text-sm font-semibold text-brand-800 ring-1 ring-brand-100">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive demo */}
      <section id="demo" className="scroll-mt-20 bg-surface py-20 sm:py-28">
        <div className="container-page">
          <Reveal>
            <SectionHeading
              eyebrow="See it in action"
              title="From prescription to pickup in four steps"
              intro="No queues, no paper slips, and no chance of the wrong medicine. Click a step, or let it play."
            />
          </Reveal>
          <Reveal className="mt-12" delay={100}>
            <DemoWalkthrough />
          </Reveal>
          <p className="mt-6 text-center text-xs text-muted">Illustrative sample data.</p>
        </div>
      </section>

      {/* Audiences */}
      <section className="container-page py-20 sm:py-28">
        <Reveal>
          <SectionHeading eyebrow="Who it's for" title="One platform, three sides of the counter" center />
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {audiences.map((a, i) => (
            <Reveal key={a.title} delay={i * 120} className="h-full">
              <div className="group flex h-full flex-col rounded-2xl bg-white p-7 shadow-card ring-1 ring-line transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-900/10">
                <span className="brand-gradient grid h-12 w-12 place-items-center rounded-xl text-white transition-transform duration-300 group-hover:scale-110">
                  <a.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-ink">{a.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{a.body}</p>
                <Link href={a.href} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-800">
                  {a.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-surface py-20 sm:py-28">
        <div className="container-page">
          <Reveal>
            <SectionHeading
              eyebrow="The machine"
              title="Robotics that pharmacists can trust"
              intro="Each Farmacia Tech machine combines computer vision, adaptive grasping and a secure cloud platform, so it never guesses."
            />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 100} className="h-full">
                <div className="group h-full rounded-2xl bg-white p-6 ring-1 ring-line transition hover:ring-brand-200">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-bold text-ink">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10">
            <Link href="/machine" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-800">
              Explore the machine <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Trust */}
      <section className="relative overflow-hidden bg-brand-950 py-20 sm:py-24">
        <div className="bg-grid absolute inset-0 opacity-60" />
        <div className="container-page relative">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-300">Safety & privacy</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl text-balance">
              Health data deserves more than a login screen
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {trust.map((t, i) => (
              <Reveal key={t.title} delay={i * 120} className="h-full">
                <div className="h-full rounded-2xl bg-white/5 p-7 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/10">
                  <t.icon className="h-6 w-6 text-brand-300" />
                  <h3 className="mt-4 font-bold text-white">{t.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-100/80">{t.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ preview + updates */}
      <section className="container-page grid gap-14 py-20 sm:py-28 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <Reveal>
            <SectionHeading eyebrow="FAQ" title="Questions we hear a lot" />
          </Reveal>
          <Reveal className="mt-8" delay={100}>
            <FaqList items={faqs.filter((_, i) => [0, 1, 7, 10].includes(i))} />
          </Reveal>
          <Link href="/faq" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-800">
            All questions <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div>
          <Reveal>
            <SectionHeading eyebrow="Updates" title="What we're building" />
          </Reveal>
          <div className="mt-8 space-y-4">
            {updates.slice(0, 2).map((u, i) => (
              <Reveal key={u.title} delay={i * 120}>
                <article className="rounded-2xl bg-surface p-6 ring-1 ring-line">
                  <p className="text-xs font-semibold text-brand-600">{u.tag} · {u.date}</p>
                  <h3 className="mt-2 font-bold text-ink">{u.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{u.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <Link href="/updates" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-800">
            All updates <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
