"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Product, Category } from "@/lib/types";
import ProductCard from "./ProductCard";
import { ProductGridSkeleton } from "./Skeleton";
import { getProductSales, rankBySales } from "@/lib/sales";

export default function ShopBrowser() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeSlug = searchParams.get("category") || "";
  // The navbar's "Shop" link sends people here with ?pick=1 — show the
  // pancakes-vs-puff-puff picker first instead of dumping the whole menu on
  // them. Every other link into /shop (footer, "view all", back-to-menu, …)
  // has no ?pick param, so it keeps going straight to the full grid.
  const showPicker = searchParams.get("pick") === "1" && !activeSlug;

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
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

  // Only categories that actually have a live product — keeps the picker (and
  // the chip row) free of empty leftover categories like a test "Best seller".
  const shoppableCategories = useMemo(
    () => categories.filter((c) => products.some((p) => p.category === c.name)),
    [categories, products]
  );

  const visible = useMemo(() => {
    let list = products;
    if (activeCategory) list = list.filter((p) => p.category === activeCategory.name);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)
      );
    }
    // Best sellers first (units actually sold), in every view incl. "All" and each category.
    return rankBySales(list, sales);
  }, [products, activeCategory, query, sales]);

  const setCategory = (slug: string) => {
    router.push(slug ? `/shop?category=${slug}` : "/shop");
  };

  if (loading) {
    return (
      <div className="max-w-[1300px] mx-auto px-6 md:px-10 py-12 md:py-16">
        <ProductGridSkeleton count={8} />
      </div>
    );
  }

  // Landing picker: "Shop" in the nav sends people here first so they choose
  // pancakes or puff puff before seeing anything else.
  if (showPicker && shoppableCategories.length > 0) {
    return (
      <div className="max-w-[900px] mx-auto px-6 md:px-10 py-16 md:py-24 text-center">
        <span className="eyebrow">The full menu</span>
        <h1 className="font-display text-5xl md:text-6xl text-brand-dark mt-3 mb-4">
          What are you <span className="italic text-brand-primary font-normal">craving?</span>
        </h1>
        <p className="font-sans text-sm text-brand-dark/60 max-w-md mx-auto mb-12">
          Pick a menu to see what&apos;s on offer.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {shoppableCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.slug)}
              className="group relative block aspect-[5/4] rounded-[1.5rem] overflow-hidden bg-brand-dark shadow-[0_1px_2px_rgba(28,22,19,0.06)] transition-shadow duration-500 hover:shadow-[0_30px_60px_-28px_rgba(28,22,19,0.45)] text-left"
            >
              {c.image_url ? (
                <img
                  src={c.image_url}
                  alt={c.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-brand-primary to-brand-plum" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/85 via-brand-dark/20 to-transparent" />
              <div className="absolute inset-3 rounded-[1.1rem] border border-brand-light/0 group-hover:border-brand-light/25 transition-colors duration-500" />
              <div className="absolute inset-0 flex flex-col justify-end p-7">
                <h3 className="font-display text-2xl md:text-3xl text-brand-light leading-tight">{c.name}</h3>
                <span className="mt-2 inline-flex items-center gap-2 text-[11px] tracking-[0.24em] uppercase text-brand-light/80 font-semibold">
                  Shop now
                  <span className="group-hover:translate-x-1.5 transition-transform duration-300">→</span>
                </span>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => router.push("/shop")}
          className="mt-10 text-brand-grey hover:text-brand-primary text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors"
        >
          Or browse everything
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto px-6 md:px-10 py-12 md:py-16">
      {/* Header */}
      <div className="text-center mb-10">
        <span className="eyebrow">The full menu</span>
        <h1 className="font-display text-5xl md:text-7xl text-brand-dark mt-3">
          {activeCategory ? (
            <>
              {activeCategory.name}
            </>
          ) : (
            <>
              Our <span className="italic text-brand-primary font-normal">cakes</span>
            </>
          )}
        </h1>
        {activeCategory?.description && (
          <p className="font-sans text-sm text-brand-dark/60 mt-3 max-w-md mx-auto">{activeCategory.description}</p>
        )}
      </div>

      {/* Search */}
      <div className="max-w-md mx-auto mb-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cakes…"
          className="w-full bg-brand-light border border-brand-line rounded-full px-6 py-3 text-sm text-brand-dark focus:outline-none focus:border-brand-primary transition-colors"
        />
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap justify-center gap-2.5 mb-12">
        <Chip active={!activeSlug} onClick={() => setCategory("")}>All</Chip>
        {shoppableCategories.map((c) => (
          <Chip key={c.id} active={activeSlug === c.slug} onClick={() => setCategory(c.slug)}>
            {c.name}
          </Chip>
        ))}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <p className="text-center py-24 text-brand-grey font-sans text-sm uppercase tracking-widest">
          No cakes found here yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {visible.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
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
        active
          ? "bg-brand-primary text-brand-light"
          : "bg-brand-light text-brand-dark/60 border border-brand-line hover:border-brand-primary hover:text-brand-primary"
      }`}
    >
      {children}
    </button>
  );
}
