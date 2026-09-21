import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-500">{children}</p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  center = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl text-balance">
        {title}
      </h2>
      {intro && <p className="mt-4 text-lg leading-relaxed text-muted text-pretty">{intro}</p>}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  intro: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-surface">
      <div className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="container-page relative py-16 sm:py-24">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-ink sm:text-5xl text-balance">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted text-pretty">{intro}</p>
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}
