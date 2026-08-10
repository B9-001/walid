"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Stamp from "./Stamp";

const quotes = [
  {
    quote:
      "Honestly the milkcake was so good. My whole family finished it the same day. Already telling my friends to order from you.",
    name: "Fatima S",
    role: "Milkcake, Abuja",
  },
  {
    quote:
      "I ordered for my wife's birthday and she loved it. Delivery came on time and everything was fresh. Will definitely order again.",
    name: "Salim K",
    role: "Birthday order, Abuja",
  },
  {
    quote:
      "The cheesecake is the best I have had in Abuja. You can tell it is made properly. I keep coming back for more.",
    name: "Abdurrahman A",
    role: "Cheesecake, Abuja",
  },
  {
    quote:
      "Everything tasted fresh and the packaging was really nice. Got it delivered the same day. Thank you so much.",
    name: "Salma K",
    role: "Dessert cups, Abuja",
  },
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function Testimonial() {
  const [i, setI] = useState(0);
  const t = quotes[i];

  const go = (dir: number) => setI((c) => (c + dir + quotes.length) % quotes.length);

  return (
    <section className="py-20 md:py-28 bg-brand-paper">
      <div className="container">
        <div className="relative rounded-[2rem] bg-brand-light border border-brand-line px-7 py-14 md:px-16 md:py-20 text-center overflow-hidden">
          {/* rotating stamp accent */}
          <div className="absolute top-6 right-6 hidden md:block">
            <Stamp tone="plum" size={96} text="CUSTOMER LOVE · DIAMOND TASTE · " />
          </div>

          <span className="font-display italic text-7xl md:text-8xl text-brand-primary/25 leading-none block h-12 md:h-14 select-none">
            &ldquo;
          </span>

          <AnimatePresence mode="wait">
            <motion.blockquote
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
              className="font-display text-2xl md:text-4xl text-brand-dark leading-snug max-w-3xl mx-auto"
              style={{ fontWeight: 400 }}
            >
              {t.quote}
            </motion.blockquote>
          </AnimatePresence>

          <div className="mt-10 flex items-center justify-center gap-6">
            <button
              aria-label="Previous"
              onClick={() => go(-1)}
              className="w-11 h-11 rounded-full border border-brand-line flex items-center justify-center text-brand-dark hover:bg-brand-primary hover:text-brand-light hover:border-brand-primary transition-colors"
            >
              ←
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-blush border border-brand-line flex items-center justify-center shrink-0">
                <span className="font-sans text-sm font-bold text-brand-primary">{initials(t.name)}</span>
              </div>
              <div className="text-left">
                <div className="font-display text-lg text-brand-dark leading-none">{t.name}</div>
                <div className="text-[11px] tracking-[0.18em] uppercase text-brand-grey mt-1">{t.role}</div>
              </div>
            </div>
            <button
              aria-label="Next"
              onClick={() => go(1)}
              className="w-11 h-11 rounded-full border border-brand-line flex items-center justify-center text-brand-dark hover:bg-brand-primary hover:text-brand-light hover:border-brand-primary transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
