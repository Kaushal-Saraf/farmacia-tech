import { ButtonLink } from "@/components/Button";

export function CtaBand({
  title = "Bring 24×7 prescription access to your campus or clinic.",
  body = "We're partnering with hospitals, clinics, pharmacies and institutions for early deployments. Tell us about your site and we'll get in touch.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="container-page py-20">
      <div className="brand-gradient relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand-300/20 blur-2xl" />
        <h2 className="relative mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl text-balance">
          {title}
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-brand-100 text-pretty">{body}</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/contact" variant="white">Request a demo</ButtonLink>
          <ButtonLink href="/how-it-works" className="bg-white/10 ring-1 ring-inset ring-white/30 hover:bg-white/20">
            See how it works
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
