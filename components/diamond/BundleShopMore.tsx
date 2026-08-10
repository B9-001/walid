"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/lib/types";
import ProductCard from "./ProductCard";
import { ProductGridSkeleton } from "./Skeleton";
import { getProductSales, rankBySales } from "@/lib/sales";

// Bestsellers on the /bundles page so shoppers can buy singles too, not only boxes.
// Same "featured + real bestseller ranking" source as the home page row.
export default function BundleShopMore() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("diamond_products").select("*").eq("active", true).eq("featured", true),
      getProductSales(),
    ]).then(([{ data }, sales]) => {
      if (data) setProducts(rankBySales(data as Product[], sales).slice(0, 4));
      setLoading(false);
    });
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <section className="bg-brand-paper border-t border-brand-line">
      <div className="max-w-[1000px] mx-auto px-6 md:px-10 py-16 md:py-20">
        <div className="text-center mb-10">
          <span className="font-sans text-[11px] tracking-[0.25em] uppercase text-brand-primary">
            Not into boxes?
          </span>
          <h2 className="font-display text-4xl md:text-5xl text-brand-dark mt-3">
            Shop our <span className="font-script text-brand-primary font-normal">bestsellers</span>
          </h2>
          <p className="font-sans text-sm text-brand-dark/60 mt-3 max-w-lg mx-auto">
            Grab any treat on its own — no box required.
          </p>
        </div>

        {loading ? (
          <ProductGridSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-brand-primary text-brand-light px-10 py-4 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all shadow-lg shadow-brand-primary/30"
          >
            Shop all
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
