"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/lib/types";
import ProductCard from "./ProductCard";
import { ProductGridSkeleton } from "./Skeleton";
import { getProductSales, rankBySales } from "@/lib/sales";

export default function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only products you mark "Featured on home" in the admin appear here. That toggle is
    // your control over the homepage selection. Within those, we rank by REAL bestsellers
    // (units actually sold) so the top sellers lead the "New & Bestselling" row.
    Promise.all([
      supabase.from("diamond_products").select("*").eq("active", true).eq("featured", true),
      getProductSales(),
    ]).then(([{ data }, sales]) => {
      if (data) setProducts(rankBySales(data as Product[], sales).slice(0, 8));
      setLoading(false);
    });
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <section className="py-20 md:py-28 bg-brand-paper">
      <div className="container">
        <motion.div 
          className="flex items-end justify-between gap-6 mb-10 md:mb-14"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div>
            <span className="eyebrow">Fresh from the kitchen</span>
            <h2 className="font-display text-4xl md:text-5xl text-brand-dark leading-none mt-3">
              New <span className="italic text-brand-primary">&amp; Bestselling</span>
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden sm:inline-flex text-[11px] tracking-[0.18em] uppercase font-semibold text-brand-dark hover:text-brand-primary transition-colors whitespace-nowrap"
          >
            View all →
          </Link>
        </motion.div>

        {loading ? (
          <ProductGridSkeleton count={4} />
        ) : (
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.08,
                  delayChildren: 0.1,
                }
              }
            }}
          >
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </motion.div>
        )}

        <motion.div 
          className="mt-10 text-center sm:hidden"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
        >
          <Link href="/shop" className="btn-ghost">View all cakes</Link>
        </motion.div>
      </div>
    </section>
  );
}
