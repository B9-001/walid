"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/types";

export default function CategoryShowcase() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    supabase
      .from("diamond_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setCategories(data as Category[]);
      });
  }, []);

  if (categories.length === 0) return null;

  // Rotating brand gradients so image-less tiles still feel rich and varied.
  const gradients = [
    "linear-gradient(150deg, #EC008C 0%, #8B3A62 100%)",
    "linear-gradient(150deg, #8B3A62 0%, #2B1722 100%)",
    "linear-gradient(150deg, #C1006F 0%, #6E2E4E 100%)",
    "linear-gradient(150deg, #6E2E4E 0%, #2B1722 100%)",
    "linear-gradient(150deg, #EC008C 0%, #C1006F 100%)",
    "linear-gradient(150deg, #8B3A62 0%, #EC008C 100%)",
  ];

  return (
    <section className="py-20 md:py-28 bg-brand-paper-dark/50">
      <div className="container">
        <div className="text-center mb-12 md:mb-16">
          <span className="eyebrow">Collections</span>
          <h2 className="font-display text-4xl md:text-5xl text-brand-dark leading-none mt-3">
            Shop by <span className="italic text-brand-primary">category</span>
          </h2>
          <div className="deco-dots w-24 mx-auto mt-6" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.1 }}
            >
              <Link
                href={`/shop?category=${cat.slug}`}
                className="group relative block aspect-[5/4] rounded-[1.5rem] overflow-hidden bg-brand-dark shadow-[0_1px_2px_rgba(43,23,34,0.06)] transition-shadow duration-500 hover:shadow-[0_30px_60px_-28px_rgba(43,23,34,0.45)]"
              >
                {cat.image_url ? (
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"
                  />
                ) : (
                  <>
                    <div className="absolute inset-0" style={{ background: gradients[i % gradients.length] }} />
                    {/* dotted texture + oversized watermark monogram */}
                    <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1.4px)", backgroundSize: "18px 18px" }} />
                    <span className="absolute -right-3 -bottom-6 font-display italic text-[8rem] leading-none text-brand-light/10 select-none transition-transform duration-700 group-hover:scale-110 group-hover:text-brand-light/15">
                      {cat.name.charAt(0)}
                    </span>
                  </>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/80 via-brand-dark/15 to-transparent" />

                {/* hairline frame on hover */}
                <div className="absolute inset-3 rounded-[1.1rem] border border-brand-light/0 group-hover:border-brand-light/25 transition-colors duration-500" />

                <div className="absolute inset-0 flex flex-col justify-end p-7">
                  <h3 className="font-display text-2xl md:text-3xl text-brand-light leading-tight">
                    {cat.name}
                  </h3>
                  <span className="mt-2 inline-flex items-center gap-2 text-[11px] tracking-[0.24em] uppercase text-brand-light/80 font-semibold">
                    Explore
                    <span className="group-hover:translate-x-1.5 transition-transform duration-300">→</span>
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
