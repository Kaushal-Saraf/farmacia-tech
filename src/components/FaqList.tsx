import { Plus } from "lucide-react";
import type { Faq } from "@/lib/faq";

export function FaqList({ items }: { items: Faq[] }) {
  return (
    <div className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
      {items.map((f) => (
        <details key={f.q} className="group px-6 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-semibold text-ink">
            {f.q}
            <Plus className="h-5 w-5 shrink-0 text-brand-500 transition-transform duration-300 group-open:rotate-45" />
          </summary>
          <p className="-mt-1 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
