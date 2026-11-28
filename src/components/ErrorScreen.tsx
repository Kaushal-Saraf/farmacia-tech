"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, ArrowLeft, RotateCw } from "lucide-react";
import { Button } from "@/components/Button";
import { describeError } from "@/lib/describe-error";

const subscribe = () => () => {};

/**
 * Shown when a page crashes (src/app/error.tsx and global-error.tsx). The details box says what went
 * wrong, in which browser, so a screenshot is enough to report it.
 */
export function ErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  // The details read the browser (address, version), so they appear only once the page runs in it.
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center bg-surface px-4 py-16">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-card ring-1 ring-line">
        <AlertTriangle className="h-8 w-8 text-amber-500" aria-hidden />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">This page couldn’t load</h1>
        <p className="mt-2 text-sm text-muted">
          Try again. If it keeps happening, send us a screenshot of this screen.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => retry()}>
            <RotateCw className="h-4 w-4" aria-hidden /> Try again
          </Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Button variant="ghost" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </Button>
        </div>
        {inBrowser && <ErrorDetails error={error} />}
      </div>
    </main>
  );
}

function ErrorDetails({ error }: { error: unknown }) {
  const [time] = useState(() => new Date().toISOString());
  const lines = [
    describeError(error),
    `Page: ${window.location.pathname}`, // no query string: it can hold a phone number
    `Time: ${time}`,
    `Browser: ${navigator.userAgent}`,
  ];
  return (
    <div className="mt-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Details for support</p>
      <pre className="mt-1.5 whitespace-pre-wrap break-words rounded-xl bg-surface p-3 font-mono text-xs leading-relaxed text-ink ring-1 ring-inset ring-line">
        {lines.join("\n")}
      </pre>
    </div>
  );
}
