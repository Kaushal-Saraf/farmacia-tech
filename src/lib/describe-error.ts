/**
 * A short technical description of something that was thrown, shown on screen so a user's screenshot
 * tells us what failed. Server errors only carry a generic message plus a `digest` (the code to look up
 * in the Vercel logs); browser errors keep their real message.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    const digest = (error as Error & { digest?: unknown }).digest;
    // A server error's message is React's generic "message omitted" text: only the code helps.
    if (typeof digest === "string") return `Server error, code ${digest}`;
    return `${error.name}: ${error.message}`.slice(0, 300);
  }
  return String(error).slice(0, 300);
}
