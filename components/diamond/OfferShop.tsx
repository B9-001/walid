"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { Product, Category } from "@/lib/types";
import ProductCard from "./ProductCard";
import { ProductGridSkeleton } from "./Skeleton";
import { setOfferMode } from "@/lib/offer";
import { getProductSales, rankBySales } from "@/lib/sales";

// Self-contained product browser for the offer page — filters in place (no
// navigating away to /shop) and keeps the customer inside the offer funnel.
export default function OfferShop() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setOfferMode(true); // entering the offer funnel
    Promise.all([
      supabase.from("diamond_categories").select("*").order("sort_order", { ascending: true }),
      supabase.from("diamond_products").select("*").eq("active", true).order("name", { ascending: true }),
      getProductSales(),
    ]).then(([cats, prods, salesMap]) => {
      if (cats.data) setCategories(cats.data as Category[]);
      if (prods.data) setProducts(prods.data as Product[]);
      setSales(salesMap);
      setLoading(false);
    });
  }, []);

  const activeCategory = categories.find((c) => c.slug === activeSlug);

  const visible = useMemo(() => {
    let list = products;
    if (activeCategory) list = list.filter((p) => p.category === activeCategory.name);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
    }
    // Best sellers first (units actually sold), same as the shop grid.
    return rankBySales(list, sales);
  }, [products, activeCategory, query, sales]);

  return (
    <div id="shop" className="max-w-[1300px] mx-auto px-6 md:px-10 py-12 md:py-16">
      <div className="text-center mb-8">
        <span className="eyebrow">Add to your order</span>
        <h2 className="font-display text-4xl md:text-6xl text-brand-dark mt-3">
          Shop the <span className="italic text-brand-primary font-normal">menu</span>
        </h2>
      </div>

      <div className="max-w-md mx-auto mb-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cakes…"
          className="w-full bg-brand-light border border-brand-line rounded-full px-6 py-3 text-sm text-brand-dark focus:outline-none focus:border-brand-primary transition-colors"
        />
      </div>

      <div className="flex flex-wrap justify-center gap-2.5 mb-12">
        <Chip active={!activeSlug} onClick={() => setActiveSlug("")}>All</Chip>
        {categories.map((c) => (
          <Chip key={c.id} active={activeSlug === c.slug} onClick={() => setActiveSlug(c.slug)}>{c.name}</Chip>
        ))}
      </div>

      {loading ? (
        <ProductGridSkeleton count={8} />
      ) : visible.length === 0 ? (
        <p className="text-center py-24 text-brand-grey font-sans text-sm uppercase tracking-widest">No cakes found here yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {visible.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-full font-sans text-[11px] font-semibold tracking-[0.12em] uppercase transition-all ${
        active ? "bg-brand-primary text-brand-light" : "bg-brand-light text-brand-dark/60 border border-brand-line hover:border-brand-primary hover:text-brand-primary"
      }`}
    >
      {children}
    </button>
  );
}
