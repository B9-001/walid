"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/lib/cart";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { setOfferMode, freeDeliveryMin, OFFER_FREE_DELIVERY_MIN } from "@/lib/offer";
import FreeDeliveryBar from "@/components/diamond/FreeDeliveryBar";
import CartSuggestions from "@/components/diamond/CartSuggestions";

export default function OfferCart() {
  const { items, subtotal, updateQty, removeItem, reconcile, ready } = useCart();
  const router = useRouter();

  // Being on this page means they're in the offer funnel (no vouchers)
  useEffect(() => { setOfferMode(true); }, []);

  // Same threshold checkout applies, so this page can't promise free delivery
  // the checkout then declines to give.
  const [freeThreshold, setFreeThreshold] = useState<number>(OFFER_FREE_DELIVERY_MIN);
  useEffect(() => {
    supabase
      .from("diamond_site_settings")
      .select("free_delivery_threshold")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setFreeThreshold(freeDeliveryMin(data?.free_delivery_threshold)));
  }, []);

  const unlocked = subtotal >= freeThreshold;

  const [stockMsg, setStockMsg] = useState("");
  const [checkingStock, setCheckingStock] = useState(false);
  const goCheckout = async () => {
    setStockMsg("");
    setCheckingStock(true);
    const changes = await reconcile();
    setCheckingStock(false);
    if (changes.length) {
      setStockMsg(`Your cart was updated. ${changes.join(" ")} Please review and checkout again.`);
      return;
    }
    router.push("/checkout");
  };

  if (!ready) {
    return (
      <div className="flex justify-center py-40"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-28 text-center">
        <span className="font-script text-5xl text-brand-primary/40">empty</span>
        <h1 className="font-display text-4xl md:text-5xl text-brand-dark mt-3">Your cart is empty</h1>
        <p className="font-sans text-sm text-brand-dark/60 mt-3">Add ₦20,000 worth of treats to get free delivery.</p>
        <Link href="/offer1" className="inline-block mt-8 bg-brand-primary text-brand-light px-9 py-4 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all">
          Shop the offer
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-12 md:py-16">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-display text-4xl md:text-6xl text-brand-dark">
          Your <span className="font-script text-brand-primary font-normal">cart</span>
        </h1>
        <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary mt-2">Free delivery offer</span>
      </div>

      {/* Free-delivery progress — the offer's hook */}
      <div className="mb-9">
        <FreeDeliveryBar subtotal={subtotal} threshold={freeThreshold} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <AnimatePresence>
            {items.map((it) => (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex gap-4 bg-brand-light border border-brand-line rounded-2xl p-4"
              >
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-brand-blush shrink-0">
                  {it.image ? (
                    <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><span className="font-script text-xl text-brand-primary/30">D</span></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg text-brand-dark leading-tight">{it.name}</h3>
                  <p className="font-sans text-lg font-semibold text-brand-plum mt-1.5">{formatNaira(it.price * it.quantity)}</p>
                  <div className="inline-flex items-center border border-brand-line rounded-full overflow-hidden mt-4">
                    <button onClick={() => updateQty(it.id, it.quantity - 1)} className="w-9 h-9 text-brand-primary hover:bg-brand-blush transition-colors text-lg leading-none">−</button>
                    <span className="w-10 text-center text-sm font-semibold tabular-nums">{it.quantity}</span>
                    <button onClick={() => updateQty(it.id, it.quantity + 1)} className="w-9 h-9 text-brand-primary hover:bg-brand-blush transition-colors text-lg leading-none">+</button>
                  </div>
                </div>
                <button onClick={() => removeItem(it.id)} className="text-brand-grey hover:text-brand-primary transition-colors self-start shrink-0" aria-label="remove">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Summary — no vouchers */}
        <div className="lg:col-span-1 min-w-0">
          <div className="bg-brand-light border border-brand-line rounded-2xl p-6 lg:sticky lg:top-28">
            <h2 className="font-display text-2xl text-brand-dark mb-5">Order summary</h2>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm"><span className="text-brand-dark/60">Subtotal</span><span className="text-brand-dark font-medium">{formatNaira(subtotal)}</span></div>
              <div className="flex justify-between text-sm">
                <span className="text-brand-dark/60">Delivery</span>
                <span className={unlocked ? "text-brand-primary font-semibold" : "text-brand-dark/60"}>{unlocked ? "FREE" : "Calculated at checkout"}</span>
              </div>
              <p className="text-[11px] text-brand-grey">Free on orders over ₦20,000.</p>
              <div className="flex justify-between items-baseline pt-3 border-t border-brand-line mt-3">
                <span className="font-sans font-semibold text-brand-dark">Total</span>
                <span className="font-display text-2xl text-brand-primary">{formatNaira(subtotal)}</span>
              </div>
            </div>
            {stockMsg && (
              <p className="mt-5 text-sm font-semibold text-brand-primary bg-brand-primary/5 border border-brand-primary/25 rounded-xl px-4 py-3">{stockMsg}</p>
            )}
            <button
              onClick={goCheckout}
              disabled={checkingStock}
              className="w-full mt-6 bg-brand-primary text-brand-light py-4 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all disabled:opacity-50"
            >
              {checkingStock ? "Checking stock…" : "Checkout"}
            </button>
            <Link href="/offer1" className="block text-center mt-4 text-brand-grey hover:text-brand-primary text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors">
              Add more items
            </Link>
          </div>
        </div>
      </div>

      <CartSuggestions
        gap={Math.max(0, freeThreshold - subtotal)}
        heading={unlocked ? "You might also like" : "Reach free delivery"}
        note={unlocked ? undefined : `Add a little more to hit ${formatNaira(freeThreshold)} and unlock free delivery`}
      />
    </div>
  );
}
