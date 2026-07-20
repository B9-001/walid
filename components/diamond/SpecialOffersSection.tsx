"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/lib/cart";
import { formatNaira } from "@/lib/format";
import type { Product } from "@/lib/types";

// Any product with "Show as Special Offer" switched on in /admin/products gets
// its own promo card here — photo with badges, composition line (offer_line),
// and a strike-through "was" price (old_price) if set. No offers → renders
// nothing, so there's no empty section on a fresh install.
export default function SpecialOffersSection() {
  const { addItem } = useCart();
  const router = useRouter();
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
      <div className="max-w-[1300px] mx-auto px-6 md:px-10 py-16 md:py-20">
        <div className="text-center mb-12">
          <span className="font-sans text-[11px] font-bold tracking-[0.22em] uppercase text-brand-primary-dark">Limited Time</span>
          <h2 className="font-display text-4xl md:text-5xl text-brand-dark leading-[1.15] mt-3">
            Special <span className="font-script italic text-brand-primary-dark font-normal">offers</span>
          </h2>
        </div>

        <div className={`mx-auto grid grid-cols-1 ${offers.length > 1 ? "sm:grid-cols-2" : "max-w-[420px]"} gap-8`}>
          {offers.map((product) => (
            <OfferCard key={product.id} product={product} addItem={addItem} router={router} />
          ))}
        </div>
      </div>
    </section>
  );
}

function OfferCard({
  product,
  addItem,
  router,
}: {
  product: Product;
  addItem: ReturnType<typeof useCart>["addItem"];
  router: ReturnType<typeof useRouter>;
}) {
  const soldOut = product.stock_level !== null && product.stock_level <= 0;
  const price = product.base_price;
  const compareAt = product.old_price && product.old_price > price ? product.old_price : 0;
  const save = Math.max(0, compareAt - price);

  const order = () => {
    if (soldOut) return;
    addItem({ product_id: product.product_id, name: product.name, image: product.image_url, price });
    router.push("/cart");
  };

  return (
    <div className="bg-brand-light rounded-[24px] overflow-hidden shadow-[0_8px_24px_rgba(28,22,19,0.08)]">
      <div className="relative aspect-square bg-gradient-to-br from-brand-primary to-[#B8875A] flex items-center justify-center">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="font-sans text-[13px] text-white/85 text-center px-6 tracking-wide leading-relaxed">
            {product.name}
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
        <h3 className="font-display text-2xl text-brand-dark mb-2.5">{product.name}</h3>
        {product.description && (
          <p className="font-sans text-[14.5px] leading-relaxed text-brand-dark/65 mb-5">{product.description}</p>
        )}
        {product.offer_line && (
          <div className="font-sans text-[13px] font-bold tracking-wide text-brand-primary-dark mb-6 uppercase">
            {product.offer_line}
          </div>
        )}

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
            {soldOut ? "SOLD OUT" : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
