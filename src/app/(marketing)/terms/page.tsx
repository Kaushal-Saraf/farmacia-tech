import type { Metadata } from "next";
import { site } from "@/lib/site";
import { LegalPage } from "../LegalPage";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="September 2026">
      <p>By using {site.name} you agree to these terms.</p>
      <h2>Not a substitute for medical advice</h2>
      <p>{site.name} dispenses medicines against prescriptions issued by registered medical practitioners. It does not diagnose or give medical advice. Always follow your doctor's instructions.</p>
      <h2>Accounts</h2>
      <p>You're responsible for keeping access to your mobile number secure. Doctors must provide accurate registration details and may only prescribe within their licence.</p>
      <h2>Orders and pickup</h2>
      <p>Pickup QR codes are single-use, tied to one machine and expire after a set time. Unclaimed orders are refunded according to our refund policy.</p>
      <h2>Contact</h2>
      <p>Questions? Email <a className="text-brand-600 underline" href={`mailto:${site.email}`}>{site.email}</a>.</p>
    </LegalPage>
  );
}
