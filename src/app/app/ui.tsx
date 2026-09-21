import type { ReactNode } from "react";

export const inputClass =
  "mt-1.5 block w-full rounded-xl border-0 bg-white px-4 py-3 text-sm text-ink ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-500 focus:outline-none";

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-6 shadow-card ring-1 ring-line ${className}`}>{children}</div>;
}

export function Empty({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <Card className="py-14 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">{icon}</div>
      <p className="mt-4 font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p>
    </Card>
  );
}
