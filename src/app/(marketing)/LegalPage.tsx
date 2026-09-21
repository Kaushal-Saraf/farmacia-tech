import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="container-page max-w-3xl py-16 sm:py-24">
      <h1 className="text-4xl font-extrabold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
      <p className="mt-6 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800 ring-1 ring-brand-100">
        Draft. Have this reviewed by a lawyer before launch, especially for DPDP Act 2023 and pharmacy regulations.
      </p>
      <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-muted [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}
