export const site = {
  name: "Farmacia Tech",
  tagline: "Prescription medicines, dispensed safely — any time.",
  description:
    "Farmacia Tech builds AI-guided medicine vending machines connected to a secure e-prescription platform, so patients can collect verified prescriptions 24×7.",
  // TODO: replace with your production domain and a public contact inbox
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "medvendors01@gmail.com",
  location: "Ghaziabad, Uttar Pradesh, India",
  social: {
    linkedin: "https://www.linkedin.com/in/kaushal-saraf-400586201",
    github: "https://github.com/Kaushal-Saraf",
  },
};

export const nav = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/for-clinics", label: "For clinics" },
  { href: "/for-doctors", label: "For doctors" },
  { href: "/about", label: "About" },
];
