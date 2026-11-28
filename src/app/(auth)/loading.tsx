import { Loader2 } from "lucide-react";

/**
 * Shown inside the sign-in card while a sign-in page loads. These pages are built on the server for
 * every visit, so without this a click on "Sign in" showed nothing until the server answered.
 */
export default function Loading() {
  return (
    <div className="flex min-h-48 items-center justify-center" role="status" aria-live="polite">
      <span className="inline-flex items-center gap-2 text-sm font-medium text-muted">
        <Loader2 className="h-5 w-5 animate-spin text-brand-500" aria-hidden /> Loading…
      </span>
    </div>
  );
}
