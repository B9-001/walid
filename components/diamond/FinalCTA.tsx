"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Stamp from "./Stamp";

export default function FinalCTA() {
  return (
    <section className="py-16 md:py-24 bg-brand-paper">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative rounded-[2.5rem] bg-brand-dark text-brand-light px-7 py-16 md:px-16 md:py-24 overflow-hidden text-center"
        >
          {/* soft accents */}
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-brand-primary/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-10 w-72 h-72 rounded-full bg-brand-plum/30 blur-3xl pointer-events-none" />

          <div className="absolute top-8 right-8 hidden md:block">
            <Stamp tone="light" size={92} text="ORDER ONLINE · DIAMOND TASTE · " />
          </div>

          <span className="eyebrow text-brand-primary relative">Special moments</span>
          <h2 className="font-display text-4xl md:text-6xl leading-tight mt-4 relative" style={{ fontWeight: 400 }}>
            Let&rsquo;s make it <span className="italic text-brand-primary">extra sweet</span>
          </h2>
          <p className="text-brand-light/70 max-w-xl mx-auto mt-6 leading-relaxed relative">
            Browse the menu, pick what you love, and place your order online
            in minutes. We&rsquo;ll bring your celebration to life.
          </p>
          <div className="mt-10 relative">
            <Link href="/shop" className="btn-brand">Start your order</Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
