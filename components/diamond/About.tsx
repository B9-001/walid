"use client";

import { motion } from "framer-motion";
import Stamp from "./Stamp";
import { STORY_IMAGE } from "@/lib/images";

const stats = [
  { num: "100%", label: "Made to order" },
  { num: "2", label: "Signature treats" },
  { num: "Fresh", label: "Made daily" },
];

export default function About() {
  return (
    <section id="about" className="py-20 md:py-28 bg-brand-paper">
      <div className="container grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
        {/* Left: story */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <span className="eyebrow">Our story</span>
          <h2 className="font-display text-4xl md:text-5xl text-brand-dark leading-tight mt-4">
            Golden, fluffy, <span className="italic text-brand-primary">made with love</span>
          </h2>
          <p className="text-brand-dark/70 leading-relaxed mt-6">
            We believe the best things in life are golden, fluffy, and made with love.
          </p>
          <p className="text-brand-dark/70 leading-relaxed mt-4">
            At The Pufflette Co, every puff puff is hand-rolled and every pancake is poured
            fresh — no shortcuts, no rush. Just real ingredients, rich flavor, and that
            unmistakable creamy goodness in every bite.
          </p>
          <p className="text-brand-dark/70 leading-relaxed mt-4">
            What started as a passion for getting it right has grown into a promise:
            you&rsquo;ll never have a boring bite here.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-6">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="font-display text-3xl md:text-4xl text-brand-primary leading-none">{s.num}</div>
                <div className="text-[11px] tracking-[0.16em] uppercase text-brand-grey mt-2 leading-snug">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: deep-plum editorial panel */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative"
        >
          <div className="relative rounded-[2rem] bg-brand-dark text-brand-light p-10 md:p-14 overflow-hidden aspect-square flex flex-col justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={STORY_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/80 to-brand-dark/40" />
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-brand-primary/15 blur-3xl" />
            <div className="relative">
              <Stamp tone="light" size={84} text="THEPUFFLETTE.CO · EST. SWEET · " />
            </div>
            <div className="relative">
              <p className="font-display italic text-2xl md:text-3xl leading-snug text-brand-light/90">
                &ldquo;Taste the difference, taste thepufflette.co.&rdquo;
              </p>
              <div className="mt-6 h-px w-16 bg-brand-light/30" />
              <p className="mt-4 text-[11px] tracking-[0.2em] uppercase text-brand-light/60">
                The thepufflette.co kitchen
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
