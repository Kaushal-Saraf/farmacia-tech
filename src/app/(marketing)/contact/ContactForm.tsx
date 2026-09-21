"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { submitContact, type ContactState } from "./actions";
import { Button } from "@/components/Button";

const field =
  "mt-1.5 block w-full rounded-xl border-0 bg-white px-4 py-3 text-sm text-ink ring-1 ring-inset ring-line placeholder:text-muted/60 focus:ring-2 focus:ring-brand-500 focus:outline-none";

export function ContactForm({ defaultType = "partner" }: { defaultType?: string }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, { status: "idle" });

  if (state.status === "success") {
    return (
      <div className="rounded-2xl bg-brand-50 p-8 text-center ring-1 ring-brand-100">
        <CheckCircle2 className="mx-auto h-10 w-10 text-brand-500" />
        <h2 className="mt-4 text-xl font-bold text-ink">Thanks, we've got it.</h2>
        <p className="mt-2 text-sm text-muted">We'll get back to you within two working days.</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <input type="text" name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="text-sm font-medium text-ink">
        Name
        <input name="name" required autoComplete="name" className={field} placeholder="Your full name" />
      </label>
      <label className="text-sm font-medium text-ink">
        Email
        <input name="email" type="email" required autoComplete="email" className={field} placeholder="you@example.com" />
      </label>
      <label className="text-sm font-medium text-ink">
        Phone <span className="font-normal text-muted">(optional)</span>
        <input name="phone" type="tel" autoComplete="tel" className={field} placeholder="+91" />
      </label>
      <label className="text-sm font-medium text-ink">
        Organisation <span className="font-normal text-muted">(optional)</span>
        <input name="organisation" autoComplete="organization" className={field} placeholder="Hospital, clinic, pharmacy…" />
      </label>
      <label className="text-sm font-medium text-ink sm:col-span-2">
        I'm interested as a…
        <select name="type" defaultValue={defaultType} className={field}>
          <option value="partner">Clinic / hospital / pharmacy partner</option>
          <option value="doctor">Doctor</option>
          <option value="investor">Investor</option>
          <option value="patient">Patient</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label className="text-sm font-medium text-ink sm:col-span-2">
        Message
        <textarea name="message" required rows={5} className={field} placeholder="Tell us about your site, footfall, or what you'd like to know." />
      </label>
      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2">
          {state.message}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Send message
        </Button>
      </div>
    </form>
  );
}
