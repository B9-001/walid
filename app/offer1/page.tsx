import AnnouncementBar from "@/components/diamond/AnnouncementBar";
import Navbar from "@/components/diamond/Navbar";
import Footer from "@/components/diamond/Footer";
import OfferShop from "@/components/diamond/OfferShop";

export const metadata = { title: "Free Delivery on Orders Over ₦20,000 | Diamond Taste" };

export default function Offer1Page() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        {/* Direct offer hero */}
        <section className="relative overflow-hidden bg-brand-dark text-brand-light">
          {/* soft brand glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 w-[34rem] h-[34rem] rounded-full bg-brand-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 w-[30rem] h-[30rem] rounded-full bg-brand-plum/25 blur-3xl" />

          <div className="relative max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24 grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
            {/* Copy */}
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 font-sans text-[11px] tracking-[0.25em] uppercase text-brand-primary border border-brand-primary/40 rounded-full px-4 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" /> Limited offer
              </span>

              <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mt-6">
                Free <span className="font-script italic text-brand-primary font-normal">delivery</span>
                <span className="block mt-2 text-3xl md:text-5xl text-brand-light/90">
                  on orders over <span className="text-brand-primary font-bold">₦20,000</span>
                </span>
              </h1>

              <p className="font-sans text-sm md:text-base text-brand-light/60 mt-6 max-w-md mx-auto lg:mx-0">
                Fill your box with fresh-baked treats, get it delivered across Abuja on us, and <span className="text-brand-light font-semibold">stack a voucher at checkout</span> for even more off.
              </p>

              {/* trust chips */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-2.5 mt-7">
                {[
                  { icon: "🚚", label: "Free delivery over ₦20k" },
                  { icon: "🎟️", label: "Add a voucher for extra off" },
                  { icon: "🧁", label: "Freshly baked to order" },
                ].map((f) => (
                  <span key={f.label} className="inline-flex items-center gap-2 bg-brand-light/5 border border-brand-light/10 rounded-full px-3.5 py-1.5 text-[12px] font-medium text-brand-light/80">
                    <span>{f.icon}</span> {f.label}
                  </span>
                ))}
              </div>

              <a
                href="#shop"
                className="inline-flex items-center gap-2 mt-9 bg-brand-primary text-brand-light px-10 py-4 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all shadow-lg shadow-brand-primary/30"
              >
                Shop the offer
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </a>
            </div>

            {/* Image collage */}
            <div className="relative">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md mx-auto">
                <div className="space-y-3 sm:space-y-4 pt-8">
                  <HeroImg src="https://YOUR_SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/public/diamond-products/products/8becc91e-6fc9-4d1e-8294-b40c8603e25b-c.jpg" alt="Vanilla berry cheesecake" />
                  <HeroImg src="https://YOUR_SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/public/diamond-products/products/3e28b975-eb37-4db0-b035-9d5f023a8f39-c.jpg" alt="Tiramisu milkcake" />
                </div>
                <div className="space-y-3 sm:space-y-4">
                  <HeroImg src="https://YOUR_SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/public/diamond-products/products/6066d4b9-0707-4ad6-8eda-833a508153bd-c.jpg" alt="Chocolate cheesecake" />
                  <HeroImg src="https://YOUR_SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/public/diamond-products/products/cd2e2f6c-4999-448e-bea9-1ccd88aa8f50-c.jpg" alt="Lotus milkcake" />
                </div>
              </div>

              {/* free-delivery stamp */}
              <div className="absolute -top-3 -right-1 sm:top-2 sm:-right-3 rotate-6 bg-brand-light text-brand-dark rounded-full w-24 h-24 sm:w-28 sm:h-28 flex flex-col items-center justify-center text-center shadow-xl border-4 border-brand-primary">
                <span className="font-display text-2xl sm:text-3xl leading-none text-brand-primary">FREE</span>
                <span className="font-sans text-[8px] sm:text-[9px] font-bold tracking-[0.15em] uppercase mt-1">Delivery</span>
                <span className="font-sans text-[7px] sm:text-[8px] text-brand-dark/50 mt-0.5">over ₦20k</span>
              </div>
            </div>
          </div>
        </section>

        <OfferShop />
      </main>
      <Footer />
    </>
  );
}

function HeroImg({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-brand-plum/30 ring-1 ring-brand-light/10 shadow-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" />
    </div>
  );
}
