"use client"; // Error boundaries must be Client Components

import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { ErrorScreen } from "@/components/ErrorScreen";

/** Errors in the root layout itself. Replaces the whole document, so it brings its own html, styles and font. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        <title>Something went wrong · Farmacia Tech</title>
        <ErrorScreen error={error} retry={retry} />
      </body>
    </html>
  );
}
