"use client"; // Error boundaries must be Client Components

import { ErrorScreen } from "@/components/ErrorScreen";

/** Replaces Next.js's built-in error screen with one that shows what went wrong. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}
