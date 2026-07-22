"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ProductCard from "./ProductCard";
import type { Product } from "@/lib/types";

// Any product with "Show as Special Offer" switched on in /admin/products
// shows up here, using the same card as the rest of the site (photo, sale
// badge, category, price + strike-through, quick add). No offers → renders
// nothing, so there's no empty section on a fresh install.
export default function SpecialOffersSection() {
  const [offers, setOffers] = useState<Product[] | null>(null);

  useEffect(() => {
    supabase
      .from("diamond_products")
      .select("*")
      .eq("is_special_offer", true)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .then(({ data }) => setOffers((data as Product[]) ?? []));
  }, []);

  if (!offers || offers.length === 0) return null;

  return (
    <section className="bg-brand-paper">
      <div className="container py-16 md:py-20">
        <div className="text-center mb-10 md:mb-14">
          <span className="eyebrow">Limited time</span>
          <h2 className="font-display text-4xl md:text-5xl text-brand-dark leading-none mt-3">
            Special <span className="italic text-brand-primary">offers</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {offers.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
