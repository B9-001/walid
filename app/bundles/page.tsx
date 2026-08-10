import AnnouncementBar from "@/components/diamond/AnnouncementBar";
import Navbar from "@/components/diamond/Navbar";
import Footer from "@/components/diamond/Footer";
import BundleCards from "@/components/diamond/BundleCards";
import BundleShopMore from "@/components/diamond/BundleShopMore";

export const metadata = { title: "Build Your Box — Bundle Deals | thepufflette.co" };

export default function BundlesPage() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-brand-dark text-brand-light">
          <div className="pointer-events-none absolute -top-24 -right-24 w-[34rem] h-[34rem] rounded-full bg-brand-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 w-[30rem] h-[30rem] rounded-full bg-brand-plum/25 blur-3xl" />

          <div className="relative max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24 grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
            {/* Copy */}
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 font-sans text-[11px] tracking-[0.25em] uppercase text-brand-primary border border-brand-primary/40 rounded-full px-4 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" /> Build your box
              </span>

              <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mt-6">
                Build a box <span className="font-script italic text-brand-primary font-normal">get it</span>
                <span className="block mt-2 text-3xl md:text-5xl text-brand-light/90">
                  <span className="text-brand-primary font-bold">delivered free</span>
                </span>
              </h1>

              <p className="font-sans text-sm md:text-base text-brand-light/60 mt-6 max-w-md mx-auto lg:mx-0">
                Mix and match the pancakes and puff puff you love into a box —{" "}
                <span className="text-brand-light font-semibold">save up to ₦4,500</span> and{" "}
                <span className="text-brand-light font-semibold">delivery is on us</span>, no ₦20,000 minimum.
              </p>

              {/* trust chips */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-2.5 mt-7">
                {[
                  { icon: "🚚", label: "Free delivery on every box" },
                  { icon: "💸", label: "Save up to ₦4,500" },
                  { icon: "🧁", label: "Freshly baked to order" },
                ].map((f) => (
                  <span key={f.label} className="inline-flex items-center gap-2 bg-brand-light/5 border border-brand-light/10 rounded-full px-3.5 py-1.5 text-[12px] font-medium text-brand-light/80">
                    <span>{f.icon}</span> {f.label}
                  </span>
                ))}
              </div>

              <a
                href="#boxes"
                className="inline-flex items-center gap-2 mt-9 bg-brand-primary text-brand-light px-10 py-4 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all shadow-lg shadow-brand-primary/30"
              >
                Build your box
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </a>
            </div>

            {/* Image collage */}
            <div className="relative">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md mx-auto">
                <div className="pt-8">
                  <HeroImg src="/bundles/sweet-box.jpg" alt="Sweet Box — pick any 3" />
                </div>
                <div>
                  <HeroImg src="/bundles/box-of-5.jpg" alt="Build your box of 5" />
                </div>
              </div>

              {/* free delivery stamp */}
              <div className="absolute -top-3 -right-1 sm:top-2 sm:-right-3 rotate-6 bg-brand-light text-brand-dark rounded-full w-24 h-24 sm:w-28 sm:h-28 flex flex-col items-center justify-center text-center shadow-xl border-4 border-brand-primary">
                <span className="font-display text-2xl sm:text-3xl leading-none text-brand-primary">FREE</span>
                <span className="font-sans text-[8px] sm:text-[9px] font-bold tracking-[0.15em] uppercase mt-1">Delivery</span>
                <span className="font-sans text-[7px] sm:text-[8px] text-brand-dark/50 mt-0.5">every box</span>
              </div>
            </div>
          </div>
        </section>

        {/* The boxes */}
        <section id="boxes" className="bg-brand-cream">
          <div className="max-w-[1000px] mx-auto px-6 md:px-10 py-16 md:py-20">
            <div className="text-center mb-10">
              <h2 className="font-display text-4xl md:text-5xl text-brand-dark">
                Choose a <span className="font-script text-brand-primary font-normal">box</span>
              </h2>
              <p className="font-sans text-sm text-brand-dark/60 mt-3 max-w-lg mx-auto">
                Tap a box, pick your flavours, and it&apos;s delivered free.
              </p>
              <span className="inline-flex items-center gap-2 mt-4 bg-brand-primary/10 text-brand-primary font-sans text-[12px] font-semibold px-4 py-1.5 rounded-full">
                ⏳ Introductory pricing — grab today&apos;s price before it goes up
              </span>
            </div>

            <BundleCards />

            {/* How it works */}
            <div className="grid sm:grid-cols-3 gap-5 mt-14">
              {[
                { n: "1", t: "Pick a box", d: "Sweet Box (any 3) or Box of 5 (any 5)." },
                { n: "2", t: "Fill it up", d: "Choose your flavours — repeats welcome." },
                { n: "3", t: "Delivered free", d: "Every box ships free — no ₦20,000 minimum." },
              ].map((s) => (
                <div key={s.n} className="bg-brand-light border border-brand-line rounded-2xl p-5 text-center">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-primary text-brand-light font-display text-lg">{s.n}</span>
                  <h3 className="font-display text-lg text-brand-dark mt-3">{s.t}</h3>
                  <p className="font-sans text-[13px] text-brand-dark/60 mt-1.5 leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>

            <p className="text-center font-sans text-[12px] text-brand-grey mt-8">
              Boxes come with free delivery, so coupon codes don&apos;t apply on top.
            </p>
          </div>
        </section>

        {/* Shop singles too — bestsellers + link to the full shop */}
        <BundleShopMore />
      </main>
      <Footer />
    </>
  );
}

function HeroImg({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="aspect-square rounded-2xl overflow-hidden bg-brand-plum/30 ring-1 ring-brand-light/10 shadow-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" />
    </div>
  );
}
