"use client";

import { unstable_rethrow } from "next/navigation";
import { describeError } from "@/lib/describe-error";
import type { AuthState } from "./actions";

export type FormState = AuthState & { details?: string };

/**
 * Wraps a sign-in Server Action so that a request that fails in the browser (no connection, a copy of
 * the page from before a deploy, an error page instead of an answer) shows a message in the form
 * instead of crashing the whole page. Next.js delivers redirect() (on to the code screen, or into the
 * portal) as a thrown value: unstable_rethrow passes that on untouched.
 */
export function submitSafely(action: (prev: AuthState, formData: FormData) => Promise<AuthState>) {
  return async (prev: FormState, formData: FormData): Promise<FormState> => {
    try {
      return await action(prev, formData);
    } catch (error) {
      unstable_rethrow(error);
      console.error(error);
      return { error: "Couldn't reach the server. Reload the page and try again.", details: describeError(error) };
    }
  };
}

/** The technical reason under the message, so a screenshot tells us what failed. */
export function SubmitFailure({ details }: { details?: string }) {
  if (!details) return null;
  return <p className="break-words font-mono text-xs text-muted">Details for support: {details}</p>;
}
