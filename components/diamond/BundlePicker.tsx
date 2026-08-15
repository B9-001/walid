"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/lib/cart";
import { formatNaira } from "@/lib/format";
import { type BundleConfig, inPool } from "@/lib/bundles";
import type { BundleComponent } from "@/lib/types";
import { supabase } from "@/lib/supabase";

type PoolProduct = {
  product_id: string;
  name: string;
  category: string;
  base_price: number;
  image_url: string | null;
  stock_level: number | null;
};

export default function BundlePicker({
  bundle,
  onClose,
}: {
  bundle: BundleConfig | null;
  onClose: () => void;
}) {
  const { addItem } = useCart();
  const router = useRouter();

  const [pool, setPool] = useState<PoolProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [picks, setPicks] = useState<Record<string, number>>({});

  // Load the pool whenever a bundle opens; reset picks.
  useEffect(() => {
    if (!bundle) return;
    setPicks({});
    setLoading(true);
    supabase
      .from("diamond_products")
      .select("product_id, name, category, base_price, image_url, stock_level, active, flavors")
      .eq("active", true)
      .then(({ data }) => {
        const items = (data || [])
          .filter((p) => inPool(bundle, p))
          .filter((p) => p.stock_level === null || p.stock_level > 0) // in stock only
          // A product sold in flavours can't go in a box: the picker has no
          // per-item flavour choice, so it would produce a line the kitchen
          // can't fulfil. It stays buyable from its own product page.
          .filter((p) => !Array.isArray(p.flavors) || p.flavors.length === 0)
          .sort((a, b) => b.base_price - a.base_price);
        setPool(items);
        setLoading(false);
      });
  }, [bundle]);

  const totalPicked = useMemo(() => Object.values(picks).reduce((s, n) => s + n, 0), [picks]);
  const worth = useMemo(
    () => pool.reduce((s, p) => s + p.base_price * (picks[p.product_id] || 0), 0),
    [pool, picks]
  );

  if (!bundle) return null;

  // Sweet Box: pay the picked items' price (free delivery is the perk). Box of 5:
  // a fixed price with a product discount.
  const price = bundle.payItemPrice ? worth : bundle.priceKobo;
  const saving = bundle.payItemPrice ? 0 : Math.max(0, worth - price);
  const remaining = bundle.picks - totalPicked;
  const full = totalPicked >= bundle.picks;
  // Confirm rules: pick exactly N, and (Box of 5) the box must be worth ≥ its price.
  const belowFloor = bundle.floorGuard && worth < bundle.priceKobo;
  const canConfirm = totalPicked === bundle.picks && !belowFloor;

  const stockOf = (p: PoolProduct) => (p.stock_level === null ? Infinity : p.stock_level);

  const inc = (p: PoolProduct) => {
    if (full) return;
    if ((picks[p.product_id] || 0) >= stockOf(p)) return;
    setPicks((prev) => ({ ...prev, [p.product_id]: (prev[p.product_id] || 0) + 1 }));
  };
  const dec = (p: PoolProduct) => {
    setPicks((prev) => {
      const n = (prev[p.product_id] || 0) - 1;
      const next = { ...prev };
      if (n <= 0) delete next[p.product_id];
      else next[p.product_id] = n;
      return next;
    });
  };

  const confirm = () => {
    if (!canConfirm) return;
    const components: BundleComponent[] = pool
      .filter((p) => (picks[p.product_id] || 0) > 0)
      .map((p) => ({
        product_id: p.product_id,
        name: p.name,
        quantity: picks[p.product_id],
        unitPrice: p.base_price,
        image: p.image_url,
      }));
    const lineId = `${bundle.slug}:${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    addItem({
      product_id: lineId,
      name: bundle.name,
      image: bundle.image,
      price, // Sweet Box: items' price · Box of 5: fixed ₦25,500
      bundle: {
        slug: bundle.slug,
        name: bundle.name,
        picks: bundle.picks,
        worth,
        components,
      },
    });
    onClose();
    router.push("/cart");
  };

  return (
    <AnimatePresence>
      {bundle && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-brand-dark/50 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full sm:max-w-lg bg-brand-cream rounded-t-[28px] sm:rounded-[28px] max-h-[92vh] flex flex-col overflow-hidden shadow-[0_32px_80px_rgba(28,22,19,0.28)]"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-brand-line shrink-0 flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-[10px] font-bold tracking-[0.22em] uppercase text-brand-primary">{bundle.tagline}</p>
                <h3 className="font-display text-2xl text-brand-dark leading-none mt-1">{bundle.name}</h3>
                <p className="font-sans text-[12px] text-brand-grey mt-1.5">
                  {bundle.payItemPrice
                    ? <>Pick {bundle.picks} · <span className="font-bold text-brand-primary">free delivery</span></>
                    : <>Pick {bundle.picks} for <span className="font-bold text-brand-plum">{formatNaira(bundle.priceKobo)}</span> · <span className="font-bold text-brand-primary">free delivery</span></>}
                </p>
              </div>
              <button onClick={onClose} className="text-brand-dark/40 hover:text-brand-primary shrink-0" aria-label="Close">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Flavour grid */}
            <div className="p-5 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : pool.length === 0 ? (
                <p className="text-center py-16 font-sans text-sm text-brand-grey">These flavours are out of stock right now. Please check back soon.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {pool.map((p) => {
                    const qty = picks[p.product_id] || 0;
                    const maxed = qty >= stockOf(p);
                    return (
                      <div key={p.product_id} className={`border rounded-2xl p-2.5 flex flex-col transition-colors ${qty > 0 ? "border-brand-primary bg-brand-primary/5" : "border-brand-line bg-brand-light"}`}>
                        <div className="aspect-square rounded-xl overflow-hidden bg-brand-blush mb-2 relative">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><span className="font-script text-2xl text-brand-primary/30">D</span></div>
                          )}
                          {qty > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-brand-primary text-brand-light text-[12px] font-bold flex items-center justify-center shadow">{qty}</span>
                          )}
                        </div>
                        <h4 className="font-sans text-[12px] font-semibold text-brand-dark leading-tight line-clamp-2 min-h-[2.4em]">{p.name}</h4>
                        <span className="font-sans text-[12px] text-brand-grey mt-0.5">{formatNaira(p.base_price)}</span>
                        <div className="flex items-center justify-between mt-2">
                          <button
                            onClick={() => dec(p)}
                            disabled={qty === 0}
                            className="w-7 h-7 rounded-full border border-brand-line text-brand-primary text-lg leading-none flex items-center justify-center disabled:opacity-30 hover:bg-brand-blush transition-colors"
                            aria-label={`Remove one ${p.name}`}
                          >−</button>
                          <span className="text-sm font-semibold tabular-nums w-6 text-center">{qty}</span>
                          <button
                            onClick={() => inc(p)}
                            disabled={full || maxed}
                            className="w-7 h-7 rounded-full bg-brand-primary text-brand-light text-lg leading-none flex items-center justify-center disabled:opacity-30 hover:bg-brand-primary-dark transition-colors"
                            aria-label={`Add one ${p.name}`}
                          >+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sticky footer: progress + live savings + confirm */}
            <div className="border-t border-brand-line bg-brand-cream px-5 pt-4 pb-5 shrink-0 space-y-3">
              {/* progress dots */}
              <div className="flex items-center justify-between">
                <span className="font-sans text-[12px] font-semibold text-brand-dark">
                  {totalPicked} of {bundle.picks} picked
                </span>
                <div className="flex gap-1.5">
                  {Array.from({ length: bundle.picks }).map((_, i) => (
                    <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < totalPicked ? "bg-brand-primary" : "bg-brand-line"}`} />
                  ))}
                </div>
              </div>

              {/* live tally */}
              {totalPicked > 0 && (
                <div className="rounded-xl bg-brand-light border border-brand-line px-4 py-2.5 text-[12px] font-sans text-brand-dark/80 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {bundle.payItemPrice ? (
                    <>
                      <span>Total <span className="font-bold text-brand-plum">{formatNaira(worth)}</span></span>
                      <span className="font-bold text-brand-primary">+ 🚚 free delivery</span>
                    </>
                  ) : (
                    <>
                      <span>Worth <span className="line-through text-brand-grey">{formatNaira(worth)}</span></span>
                      <span>→ pay <span className="font-bold text-brand-plum">{formatNaira(price)}</span></span>
                      {saving > 0 && !belowFloor && (
                        <span className="font-bold text-brand-primary">→ save {formatNaira(saving)} + free delivery</span>
                      )}
                    </>
                  )}
                </div>
              )}

              {belowFloor && (
                <p className="text-[11px] text-brand-primary font-medium">
                  Add pricier flavours — your box should never cost more than it&apos;s worth.
                </p>
              )}

              <button
                onClick={confirm}
                disabled={!canConfirm}
                className="w-full bg-brand-primary text-brand-light py-3.5 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all disabled:opacity-40"
              >
                {totalPicked < bundle.picks
                  ? `Pick ${remaining} more`
                  : belowFloor
                  ? "Add pricier flavours"
                  : `Add box — ${formatNaira(price)}`}
              </button>
              <p className="text-center text-[11px] text-brand-grey">🚚 Free delivery included with every box.</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
