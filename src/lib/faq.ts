export type Faq = { q: string; a: string; group: "Patients" | "Doctors" | "Partners" | "Safety" };

export const faqs: Faq[] = [
  { group: "Patients", q: "Do I need a paper prescription?", a: "No. Your doctor issues a digital prescription on Farmacia Tech. It appears in your account as soon as you sign in with the same mobile number." },
  { group: "Patients", q: "How do I pay?", a: "Online, before you go to the machine, by UPI, card or net banking. The machine itself never handles cash." },
  { group: "Patients", q: "What if I don't collect my medicines?", a: "Pickup codes expire after a set time. Unclaimed orders are released back to stock and refunded according to our refund policy." },
  { group: "Patients", q: "Can someone else collect for me?", a: "Yes. The pickup QR works for whoever scans it at the right machine, so share it only with someone you trust. It can be used once." },
  { group: "Patients", q: "Can I buy medicines without a prescription?", a: "Prescription-only medicines are released only against a valid e-prescription from a verified doctor. Partners may stock some over-the-counter items in future where rules allow." },
  { group: "Doctors", q: "How do I start prescribing?", a: "Sign in with your mobile number, then submit your medical registration number and qualification. Once our team verifies them, prescribing is unlocked." },
  { group: "Doctors", q: "Can I see a patient's past prescriptions?", a: "You can see the prescriptions you have issued. Wider history sharing will need the patient's explicit consent." },
  { group: "Partners", q: "Where can a machine be installed?", a: "Anywhere with power, network connectivity and footfall: hospital OPDs, clinics, pharmacies, campuses, offices and residential societies." },
  { group: "Partners", q: "Who restocks the machine?", a: "The partner pharmacy or operator. The dashboard shows stock per slot and flags low stock and upcoming expiry dates." },
  { group: "Partners", q: "What does it cost?", a: "Pricing depends on the site and model (outright purchase or revenue share). Contact us for a proposal." },
  { group: "Safety", q: "How is my health data protected?", a: "It's encrypted, stored on servers in India and visible only to you and your doctor. We don't collect Aadhaar numbers." },
  { group: "Safety", q: "How does the machine avoid giving the wrong medicine?", a: "Each order is checked against the prescription, the payment and the machine's live stock before a QR code is issued. At pickup, the vision system confirms each pack before it's released." },
];
