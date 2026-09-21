/** Public URL: NEXT_PUBLIC_SITE_URL if set (and valid), else Vercel's URL, else localhost. */
function siteUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  ];
  for (const c of candidates) {
    const v = c?.trim();
    if (!v) continue;
    try {
      return new URL(v.startsWith("http") ? v : `https://${v}`).origin;
    } catch {
      // ignore invalid values and try the next one
    }
  }
  return "http://localhost:3000";
}

export const site = {
  name: "Farmacia Tech",
  tagline: "Prescription medicines, dispensed safely — any time.",
  description:
    "Farmacia Tech builds AI-guided medicine vending machines connected to a secure e-prescription platform, so patients can collect verified prescriptions 24×7.",
  // TODO: replace with your production domain and a public contact inbox
  url: siteUrl(),
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
