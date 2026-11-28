import { Loader2 } from "lucide-react";

/** Shown while a portal page loads its data, so clicking a tab always gives feedback. */
export default function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <span className="inline-flex items-center gap-2 text-sm font-medium text-muted">
        <Loader2 className="h-5 w-5 animate-spin text-brand-500" aria-hidden /> Loading…
      </span>
    </div>
  );
}
