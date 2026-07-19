import Link from "next/link";
import BundleCards from "@/components/diamond/BundleCards";

// Home-page bundle section. Shows the two build-your-box offers with their
// save-up-to badges; each card opens the picker.
export default function BundleSection() {
  return (
    <section className="bg-brand-cream">
      <div className="max-w-[1000px] mx-auto px-6 md:px-10 py-16 md:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-9">
          <div>
            <span className="font-sans text-[11px] font-bold tracking-[0.22em] uppercase text-brand-primary">Build your box</span>
            <h2 className="font-display text-4xl md:text-5xl text-brand-dark mt-2">
              Mix, match & <span className="font-script text-brand-primary font-normal">save</span>
            </h2>
          </div>
          <Link
            href="/bundles"
            className="hidden sm:inline-flex items-center gap-2 text-brand-primary font-sans text-[11px] font-bold tracking-[0.16em] uppercase hover:gap-3 transition-all"
          >
            See how it works
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>

        <BundleCards />
      </div>
    </section>
  );
}
