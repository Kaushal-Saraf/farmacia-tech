import type { Metadata } from "next";
import { site } from "@/lib/site";
import { LegalPage } from "../LegalPage";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="September 2026">
      <p>{site.name} handles health information, and we take that seriously. This page explains what we collect and why.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your mobile number and name, so you can sign in.</li>
        <li>Prescriptions issued to you by verified doctors on the platform.</li>
        <li>Order, payment reference and pickup records for medicines you buy.</li>
        <li>For doctors: medical registration number and supporting documents for verification.</li>
      </ul>
      <h2>What we don't collect</h2>
      <p>We do not collect or store Aadhaar numbers. Card and UPI details are handled by our payment provider and never reach our servers.</p>
      <h2>Who can see your data</h2>
      <p>Your prescriptions are visible only to you and the doctor who issued them. Machine operators see which medicines were dispensed, not who they were dispensed to.</p>
      <h2>Where it's stored</h2>
      <p>Data is encrypted and stored on servers located in India.</p>
      <h2>Your rights</h2>
      <p>You can ask to access, correct or delete your data at any time by writing to <a className="text-brand-600 underline" href={`mailto:${site.email}`}>{site.email}</a>.</p>
    </LegalPage>
  );
}
