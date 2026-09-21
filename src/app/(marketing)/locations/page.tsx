import type { Metadata } from "next";
import { MapPin, Navigation } from "lucide-react";
import { ButtonLink } from "@/components/Button";
import { PageHero } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { getPublicMachines } from "@/lib/supabase/public";

export const metadata: Metadata = {
  title: "Find a machine",
  description: "Locations of Farmacia Tech medicine vending machines.",
};

// Refresh the list every 5 minutes.
export const revalidate = 300;

function mapEmbed(lat: number, lng: number) {
  const d = 0.01;
  const bbox = [lng - d, lat - d, lng + d, lat + d].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

export default async function LocationsPage() {
  const machines = await getPublicMachines();
  const first = machines.find((m) => m.latitude != null && m.longitude != null);

  return (
    <>
      <PageHero
        eyebrow="Find a machine"
        title="Machines near you"
        intro="Every machine listed here is live and connected. When you fill a prescription, the app shows only the machines that have all your medicines in stock."
      />
      <section className="container-page py-16">
        {machines.length === 0 ? (
          <Reveal>
            <div className="grid items-center gap-10 overflow-hidden rounded-3xl bg-surface p-8 ring-1 ring-line sm:p-12 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand-500 ring-1 ring-line">
                  <MapPin className="h-7 w-7" />
                </span>
                <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">Our first pilot sites are coming soon</h2>
                <p className="mt-3 max-w-lg text-muted">
                  We're finalising locations in Delhi NCR. Know a hospital, campus or society that needs 24×7 access to medicines? Tell us.
                </p>
                <ButtonLink href="/contact?type=partner" className="mt-6">Suggest a location</ButtonLink>
              </div>
              <div className="relative mx-auto aspect-square w-full max-w-xs">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="absolute inset-0 m-auto h-full w-full animate-ping rounded-full border-2 border-brand-300/50" style={{ animationDuration: "3s", animationDelay: `${i}s` }} />
                ))}
                <span className="brand-gradient absolute inset-0 m-auto grid h-20 w-20 place-items-center rounded-full text-white shadow-xl">
                  <MapPin className="h-9 w-9" />
                </span>
              </div>
            </div>
          </Reveal>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            <ul className="space-y-3">
              {machines.map((m) => (
                <li key={m.code} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-500">{m.code}</p>
                  <p className="mt-1 font-bold text-ink">{m.name}</p>
                  {m.address && <p className="mt-1 text-sm text-muted">{m.address}</p>}
                  {m.latitude != null && m.longitude != null && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${m.latitude},${m.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
                    >
                      <Navigation className="h-4 w-4" /> Directions
                    </a>
                  )}
                </li>
              ))}
            </ul>
            {first && (
              <div className="overflow-hidden rounded-3xl ring-1 ring-line lg:sticky lg:top-24 lg:h-[480px]">
                <iframe
                  title={`Map showing ${first.name}`}
                  src={mapEmbed(first.latitude!, first.longitude!)}
                  className="h-80 w-full lg:h-full"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
