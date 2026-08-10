"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BUNDLES, type BundleConfig } from "@/lib/bundles";
import { formatNaira } from "@/lib/format";
import BundlePicker from "@/components/diamond/BundlePicker";

// The bundle offer cards + the picker. Reused on the home page section and on
// the /bundles landing page.
export default function BundleCards() {
  const [active, setActive] = useState<BundleConfig | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {BUNDLES.map((b, i) => (
          <motion.button
            key={b.slug}
            onClick={() => setActive(b)}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="group text-left bg-brand-light border border-brand-line rounded-[26px] overflow-hidden flex flex-col hover:border-brand-primary/50 hover:shadow-[0_24px_60px_rgba(43,23,34,0.12)] transition-all"
          >
            <div className="relative aspect-square overflow-hidden bg-brand-blush">
              <img
                src={b.image}
                alt={b.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <span className="absolute top-4 left-4 bg-brand-primary text-brand-light text-[10px] font-bold tracking-[0.16em] uppercase px-3 py-1.5 rounded-full shadow">
                {b.tagline}
              </span>
              <span className="absolute top-4 right-4 bg-brand-light text-brand-primary text-[10px] font-bold tracking-[0.14em] uppercase px-3 py-1.5 rounded-full shadow">
                🚚 Free delivery
              </span>
              {!b.payItemPrice && (
                <span className="absolute bottom-4 left-4 right-4 bg-brand-dark/70 backdrop-blur-sm text-brand-light text-[12px] font-semibold px-3.5 py-2 rounded-xl">
                  Save up to {formatNaira(b.saveUpToKobo)}
                </span>
              )}
            </div>

            <div className="p-5 flex flex-col flex-1">
              <h3 className="font-display text-2xl text-brand-dark leading-tight">{b.name}</h3>
              <p className="font-sans text-[13px] text-brand-dark/60 mt-1.5 leading-relaxed flex-1">{b.blurb}</p>
              <div className="flex items-center justify-between gap-2.5 mt-4">
                <span className="font-display text-xl sm:text-2xl text-brand-primary whitespace-nowrap shrink-0">
                  {b.payItemPrice ? `From ${formatNaira(b.fromKobo ?? 0)}` : formatNaira(b.priceKobo)}
                </span>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 bg-brand-primary text-brand-light px-4 sm:px-5 py-2.5 rounded-full text-[10px] font-bold tracking-[0.1em] uppercase group-hover:bg-brand-primary-dark transition-colors">
                  Build your box
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" /></svg>
                </span>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <BundlePicker bundle={active} onClose={() => setActive(null)} />
    </>
  );
}
