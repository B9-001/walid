"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { isQuickAdd } from "@/lib/product";

// Quick-add suggestions. When `gap` > 0, items that would close the gap (e.g.
// reach the free-delivery threshold) are surfaced first and badged.
export default function CartSuggestions({
  gap = 0,
  heading = "You might also like",
  note,
}: {
  gap?: number;
  heading?: string;
  note?: string;
}) {
  const { items, addItem } = useCart();
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("diamond_products")
      .select("id, product_id, name, image_url, base_price, sizes, stock_level")
      .eq("active", true)
      .gt("base_price", 0)
      .order("base_price", { ascending: true })
      .limit(20)
      .then(({ data }) => setProducts((data || []).filter((p: any) => isQuickAdd(p))));
  }, []);

  const cartIds = new Set(items.map((it) => it.product_id));
  const suggested = useMemo(() => {
    const pool = products.filter((p) => !cartIds.has(p.product_id));
    if (gap > 0) {
      pool.sort((a, b) => {
        const au = a.base_price >= gap ? 0 : 1;
        const bu = b.base_price >= gap ? 0 : 1;
        return au - bu || a.base_price - b.base_price;
      });
    }
    return pool.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, items, gap]);

  if (!suggested.length) return null;

  return (
    <div className="mt-16">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="font-display text-2xl md:text-3xl text-brand-dark">{heading}</h2>
        {note && <span className="hidden sm:block font-sans text-[11px] text-brand-grey">{note}</span>}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {suggested.map((p) => {
          const reaches = gap > 0 && p.base_price >= gap;
          return (
            <div key={p.product_id} className="bg-brand-light border border-brand-line rounded-2xl overflow-hidden flex flex-col">
              <Link href={`/product?id=${p.id}`} className="block aspect-square bg-brand-blush overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><span className="font-script text-2xl text-brand-primary/30">D</span></div>
                )}
              </Link>
              <div className="p-3 flex flex-col flex-1">
                <h3 className="font-sans text-[13px] font-semibold text-brand-dark leading-tight line-clamp-2 min-h-[2.4em]">{p.name}</h3>
                {reaches && <span className="mt-1 inline-block self-start text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary">Gets free delivery</span>}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="font-sans text-sm font-semibold text-brand-plum">{formatNaira(p.base_price)}</span>
                  <button
                    onClick={() => addItem({ product_id: p.product_id, name: p.name, image: p.image_url, price: p.base_price })}
                    className="shrink-0 bg-brand-primary text-brand-light w-8 h-8 rounded-full flex items-center justify-center hover:bg-brand-primary-dark transition-colors text-lg leading-none"
                    aria-label={`Add ${p.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
