"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/lib/cart";
import { checkOne } from "@/lib/stock";
import { cartPath } from "@/lib/offer";
import { ProductDetailSkeleton, ProductGridSkeleton } from "./Skeleton";
import ProductCard from "./ProductCard";
import { getProductSales, rankBySales } from "@/lib/sales";
import { formatNaira } from "@/lib/format";
import { isPreorder, formatPreorderDate } from "@/lib/product";
import { fbTrack } from "@/lib/fbpixel";
import { track } from "@/lib/analytics";
import { trackCustomerEvent } from "@/lib/track";
import type { Product } from "@/lib/types";

export default function ProductDetail({ id }: { id: string }) {
  const router = useRouter();
  const { addItem, items } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [stockErr, setStockErr] = useState("");
  const [related, setRelated] = useState<Product[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    supabase
      .from("diamond_products")
      .select("*")
      .eq("id", id)
      .eq("active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProduct(data as Product);
          const p = data as Product;
          fbTrack("ViewContent", {
            content_name: p.name,
            content_ids: [p.product_id],
            content_type: "product",
            value: (p.base_price || 0) / 100,
            currency: "NGN",
          });
          track("view_product", { label: p.name, value: Math.round((p.base_price || 0) / 100) });
          void trackCustomerEvent("view_product", { product_id: p.product_id, product_name: p.name, value: p.base_price || 0 });
        }
        setLoading(false);
      });
  }, [id]);

  // "You may also like": other active cakes in the same category, ranked by real
  // bestsellers. Falls back to top sellers across the whole menu when the category has
  // no other items, and hides entirely if there's truly nothing else to show.
  useEffect(() => {
    if (!product) return;
    setRelatedLoading(true);
    Promise.all([
      supabase.from("diamond_products").select("*").eq("active", true),
      getProductSales(),
    ]).then(([{ data }, sales]) => {
      const others = ((data as Product[]) || []).filter((p) => p.id !== product.id);
      const sameCategory = others.filter((p) => p.category === product.category);
      const pool = sameCategory.length > 0 ? sameCategory : others;
      setRelated(rankBySales(pool, sales).slice(0, 4));
      setRelatedLoading(false);
    });
  }, [product]);

  const soldOut = product !== null && product.stock_level !== null && product.stock_level === 0;
  const preorder = product !== null && isPreorder(product);

  const gallery = useMemo(() => {
    if (!product) return [];
    return [product.image_url, ...(product.images || [])].filter(Boolean) as string[];
  }, [product]);
  const [activeImg, setActiveImg] = useState(0);

  if (loading) {
    return <ProductDetailSkeleton />;
  }

  if (!product) {
    return (
      <div className="text-center py-40 px-6">
        <h1 className="font-display text-4xl text-brand-dark">Item not found</h1>
        <Link href="/shop" className="inline-block mt-6 text-brand-primary font-semibold uppercase tracking-widest text-xs border-b border-brand-primary pb-1">
          Back to menu
        </Link>
      </div>
    );
  }

  const stepImg = (dir: number) => {
    if (gallery.length < 2) return;
    setActiveImg((i) => (i + dir + gallery.length) % gallery.length);
  };

  const handleAdd = async (): Promise<boolean> => {
    setStockErr("");
    // Confirm live stock for the qty already in the cart plus what they're adding.
    const inCart = items.find((it) => it.product_id === product.product_id)?.quantity || 0;
    const { ok, available } = await checkOne(product.product_id, inCart + quantity);
    if (!ok) {
      setStockErr(
        available === 0
          ? "Sorry, this is now sold out."
          : `Only ${available} left${inCart ? ` and you already have ${inCart} in your cart` : ""}.`
      );
      return false;
    }
    addItem({
      product_id: product.product_id,
      name: product.name,
      image: product.image_url,
      price: product.base_price,
      quantity,
      preorder_release_at: preorder ? product.preorder_release_at : null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
    return true;
  };

  const showRail = relatedLoading || related.length > 0;

  return (
    <>
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10 md:py-16">
      <Link href="/shop" className="inline-flex items-center gap-2 text-brand-grey hover:text-brand-primary text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors mb-8">
        ← Back to menu
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* Gallery */}
        <div className="md:sticky md:top-28 min-w-0">
          <div
            className="group relative aspect-square rounded-3xl overflow-hidden bg-brand-blush select-none"
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              if (Math.abs(dx) > 40) stepImg(dx < 0 ? 1 : -1);
              touchX.current = null;
            }}
          >
            {gallery.length ? (
              <img src={gallery[activeImg]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-script text-5xl text-brand-primary/30">thepufflette.co</span>
              </div>
            )}

            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => stepImg(-1)}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-brand-light/85 backdrop-blur text-brand-dark flex items-center justify-center shadow-md opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-brand-light"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => stepImg(1)}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-brand-light/85 backdrop-blur text-brand-dark flex items-center justify-center shadow-md opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-brand-light"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" /></svg>
                </button>
                <div className="absolute bottom-3 right-3 bg-brand-dark/55 text-brand-light text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur">
                  {activeImg + 1} / {gallery.length}
                </div>
              </>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-3 mt-4">
              {gallery.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors ${
                    activeImg === i ? "border-brand-primary" : "border-transparent"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="min-w-0">
          <span className="eyebrow">{product.category}</span>
          <h1 className="font-display text-4xl md:text-5xl text-brand-dark leading-tight mt-2">{product.name}</h1>

          <div className="mt-4">
            <span className="font-display text-3xl text-brand-primary">{formatNaira(product.base_price)}</span>
          </div>

          {preorder && (
            <div className="mt-5 flex items-start gap-3 bg-brand-blush/60 border border-brand-plum/20 rounded-2xl px-4 py-3.5">
              <span className="text-lg leading-none mt-0.5">⏳</span>
              <div>
                <p className="font-sans text-[11px] font-bold tracking-[0.18em] uppercase text-brand-plum">Pre-order</p>
                <p className="font-sans text-[13px] text-brand-dark/75 mt-1 leading-relaxed">
                  Order now and we&apos;ll have it ready from <span className="font-semibold text-brand-dark">{formatPreorderDate(product.preorder_release_at)}</span>.
                </p>
              </div>
            </div>
          )}

          {product.description && (
            <p className="font-sans text-sm md:text-base text-brand-dark/70 leading-relaxed mt-5">{product.description}</p>
          )}

          <div className="mt-8">
            <label className="block font-sans text-[10px] label-track text-brand-dark/50 mb-2.5">Quantity</label>
            <div className="inline-flex items-center border border-brand-line rounded-full overflow-hidden">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-11 h-11 text-brand-primary text-lg hover:bg-brand-blush transition-colors">−</button>
              <span className="w-12 text-center font-sans font-semibold tabular-nums">{quantity}</span>
              <button onClick={() => setQuantity((q) => q + 1)} className="w-11 h-11 text-brand-primary text-lg hover:bg-brand-blush transition-colors">+</button>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            {soldOut ? (
              <div className="flex-1 py-4 rounded-full bg-brand-dark/10 text-brand-dark/40 font-sans text-[11px] font-bold tracking-[0.2em] uppercase text-center">
                Sold Out
              </div>
            ) : (
              <>
                <button
                  onClick={handleAdd}
                  className="flex-1 bg-brand-primary text-brand-light py-4 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all"
                >
                  {preorder ? "Pre-order" : "Add to Cart"} · {formatNaira(product.base_price * quantity)}
                </button>
                <button
                  onClick={async () => { if (await handleAdd()) router.push(cartPath()); }}
                  className="flex-1 border border-brand-primary text-brand-primary py-4 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary hover:text-brand-light transition-all"
                >
                  {preorder ? "Pre-order Now" : "Buy Now"}
                </button>
              </>
            )}
          </div>

          {stockErr && (
            <p className="mt-3 text-center sm:text-left text-sm font-semibold text-brand-primary">{stockErr}</p>
          )}

          <AnimatePresence>
            {added && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 text-center text-brand-plum font-sans text-sm font-medium"
              >
                ✓ Added to your cart
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>

    {showRail && (
      <section className="py-16 md:py-24 bg-brand-paper">
        <div className="container">
          <div className="mb-10 md:mb-14">
            <span className="eyebrow">More sweetness</span>
            <h2 className="font-display text-4xl md:text-5xl text-brand-dark leading-none mt-3">
              You may also <span className="italic text-brand-primary">like</span>
            </h2>
          </div>

          {relatedLoading ? (
            <ProductGridSkeleton count={4} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>
    )}
    </>
  );
}
