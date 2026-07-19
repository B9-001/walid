"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/lib/cart";
import { formatNaira } from "@/lib/format";
import { DUO_BOX_PRODUCT_ID, DUO_BOX_COMPARE_AT_KOBO } from "@/lib/bundles";

type DuoProduct = {
  base_price: number;
  old_price: number | null;
  image_url: string | null;
  stock_level: number | null;
  active: boolean;
};

// Fixed promotional combo — see lib/bundles.ts for why this is a real product
// (create it in /admin/products named exactly "The Pufflette Duo Box", which
// auto-slugs to product_id "the-pufflette-duo-box") rather than a
// build-your-own bundle. Renders nothing until that product exists, so
// there's no broken/half-built card on a fresh install.
export default function DuoBoxSection() {
  const { addItem } = useCart();
  const router = useRouter();
  const [product, setProduct] = useState<DuoProduct | null | undefined>(undefined);

  useEffect(() => {
    supabase
      .from("diamond_products")
      .select("base_price, old_price, image_url, stock_level, active")
      .eq("product_id", DUO_BOX_PRODUCT_ID)
      .maybeSingle()
      .then(({ data }) => setProduct((data as DuoProduct) ?? null));
  }, []);

  if (!product || product.active === false) return null;

  const soldOut = product.stock_level !== null && product.stock_level <= 0;
  const price = product.base_price;
  const compareAt = product.old_price && product.old_price > price ? product.old_price : DUO_BOX_COMPARE_AT_KOBO;
  const save = Math.max(0, compareAt - price);

  const order = () => {
    if (soldOut) return;
    addItem({ product_id: DUO_BOX_PRODUCT_ID, name: "The Pufflette Duo Box", image: product.image_url, price });
    router.push("/cart");
  };

  return (
    <section className="bg-brand-paper">
      <div className="max-w-[420px] mx-auto px-6 py-16 md:py-20">
        <span className="font-sans text-[11px] font-bold tracking-[0.22em] uppercase text-brand-primary-dark">Limited Combo</span>
        <h2 className="font-display text-4xl text-brand-dark leading-[1.15] mt-3 mb-7">
          Pancakes + Puff Puff. <span className="font-script italic text-brand-primary-dark font-normal">Better together.</span>
        </h2>

        <div className="bg-brand-light rounded-[24px] overflow-hidden shadow-[0_8px_24px_rgba(28,22,19,0.08)]">
          <div className="relative aspect-square bg-gradient-to-br from-brand-primary to-[#B8875A] flex items-center justify-center">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt="The Pufflette Duo Box" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <span className="font-sans text-[13px] text-white/85 text-center px-6 tracking-wide leading-relaxed">
                The Pufflette Duo Box
                <br />
                Product photo coming soon
              </span>
            )}

            <span className="absolute top-[18px] left-[18px] bg-brand-primary-dark text-white font-sans text-[12px] font-bold tracking-wide px-4 py-2.5 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.15)]">
              FREE DELIVERY — No Minimum
            </span>
            <span className="absolute top-[18px] right-[18px] bg-brand-dark text-white font-sans text-[11px] font-bold tracking-wide px-3.5 py-2 rounded-full flex items-center gap-1.5">
              <span className="text-brand-primary">★</span> Best Seller
            </span>
            <span className="absolute bottom-[18px] left-[18px] bg-white text-brand-dark font-sans text-[12px] font-bold px-4 py-2.5 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.12)] flex items-center gap-1.5">
              🚚 Fast &amp; Fresh
            </span>
          </div>

          <div className="p-7">
            <h3 className="font-display text-2xl text-brand-dark mb-2.5">The Pufflette Duo Box</h3>
            <p className="font-sans text-[14.5px] leading-relaxed text-brand-dark/65 mb-5">
              Our two bestsellers, in one box. Because why choose when you can have both.
            </p>
            <div className="font-sans text-[13px] font-bold tracking-wide text-brand-primary-dark mb-6 uppercase">
              15 Pancakes + 16 Puff Puff Pieces
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex flex-col">
                {compareAt > price && (
                  <span className="font-sans text-sm text-brand-grey line-through">{formatNaira(compareAt)}</span>
                )}
                <span className="font-display text-3xl font-bold text-brand-dark">{formatNaira(price)}</span>
                {save > 0 && (
                  <span className="font-sans text-[11px] font-bold text-brand-primary-dark mt-1">
                    You save {formatNaira(save)}
                  </span>
                )}
              </div>
              <button
                onClick={order}
                disabled={soldOut}
                className="bg-brand-dark text-white font-sans text-[13.5px] font-bold tracking-wide px-7 py-4 rounded-full hover:bg-brand-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {soldOut ? "SOLD OUT" : "ORDER YOUR DUO BOX"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
