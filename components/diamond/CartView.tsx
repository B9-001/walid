"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { validateCoupon, getAvailableVouchers, type AvailableVoucher } from "@/lib/coupon";
import { setOfferMode } from "@/lib/offer";
import FreeDeliveryBar from "@/components/diamond/FreeDeliveryBar";
import {
  hasBundle,
  cartSavings,
  lineSaving,
  fullPriceSubtotal,
  UPGRADE_MIN,
  UPGRADE_PRICE,
  UPGRADE_PRODUCT_ID,
} from "@/lib/bundles";
import type { Product } from "@/lib/types";

const COUPON_KEY = "diamond_coupon";

type SuggestionProduct = Pick<Product, "product_id" | "name" | "image_url" | "base_price">;

export default function CartView() {
  const { items, subtotal, updateQty, removeItem, addItem, reconcile, ready } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const [code, setCode] = useState("");
  // Multiple vouchers can be stacked (unless one is marked non-stackable).
  const [coupons, setCoupons] = useState<{ code: string; discount: number; couponId: string; stackable: boolean }[]>([]);
  const [couponMsg, setCouponMsg] = useState("");
  const [checking, setChecking] = useState(false);

  const [vouchersOpen, setVouchersOpen] = useState(false);
  const [vouchers, setVouchers] = useState<AvailableVoucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(true);
  const [suggestions, setSuggestions] = useState<SuggestionProduct[]>([]);

  const couponCtx = { userId: user?.id ?? null, email: user?.email ?? null };
  const cartLines = items.map((it) => ({ product_id: it.product_id, price: it.price, quantity: it.quantity }));

  // Keep the live voucher list in sync with the cart total (powers the progress
  // bar + the vouchers modal).
  useEffect(() => {
    if (subtotal === 0) return;
    let active = true;
    getAvailableVouchers(subtotal, { userId: user?.id ?? null, email: user?.email ?? null }, items.map((it) => ({ product_id: it.product_id, price: it.price, quantity: it.quantity }))).then((list) => {
      if (active) { setVouchers(list); setLoadingVouchers(false); }
    });
    return () => { active = false; };
  }, [subtotal, user?.id, user?.email]);

  // Simple, priced add-ons to suggest at the bottom of the cart
  useEffect(() => {
    supabase
      .from("diamond_products")
      .select("product_id, name, image_url, base_price")
      .eq("active", true)
      .gt("base_price", 0)
      .order("base_price", { ascending: true })
      .limit(12)
      .then(({ data }) => setSuggestions((data as SuggestionProduct[]) || []));
  }, []);

  // The closest voucher the customer can unlock by spending a little more
  const nextVoucher = useMemo(() => {
    const c = vouchers.filter((v) => v.blockedBy === "minorder" && v.minOrder > subtotal);
    if (!c.length) return null;
    return c.reduce((a, b) => (b.minOrder - subtotal < a.minOrder - subtotal ? b : a));
  }, [vouchers, subtotal]);

  // An unlocked, applicable voucher they haven't applied yet
  const unlockedVoucher = useMemo(
    () => vouchers.find((v) => v.applicable && v.discountPreview > 0 && !coupons.some((c) => c.code === v.code)) || null,
    [vouchers, coupons]
  );

  // The normal cart is the normal funnel: leave any offer mode
  useEffect(() => { setOfferMode(false); }, []);

  // Restore any previously applied vouchers (supports the old single-coupon format)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COUPON_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setCoupons(Array.isArray(parsed) ? parsed : [parsed]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const saveCoupons = (list: { code: string; discount: number; couponId: string; stackable: boolean }[]) => {
    setCoupons(list);
    if (list.length) localStorage.setItem(COUPON_KEY, JSON.stringify(list));
    else localStorage.removeItem(COUPON_KEY);
  };

  // Would adding (or keeping) `vCode` clash with the non-stackable rule? A voucher
  // that isn't stackable must be used on its own.
  const stackConflict = (vStackable: boolean, vCode: string) => {
    const others = coupons.filter((c) => c.code.toLowerCase() !== vCode.toLowerCase());
    if (others.length === 0) return false;
    if (!vStackable) return true; // this voucher must be used alone
    return others.some((c) => !c.stackable); // an applied voucher must be used alone
  };

  // Re-validate every applied voucher whenever the subtotal changes; drop any that
  // no longer qualify and refresh their discounts.
  useEffect(() => {
    if (coupons.length === 0 || subtotal === 0) return;
    Promise.all(coupons.map((c) => validateCoupon(c.code, subtotal, couponCtx, cartLines))).then((results) => {
      const valid = results
        .filter((r) => r.valid && r.discount != null)
        .map((r) => ({ code: r.code!, discount: r.discount!, couponId: r.couponId!, stackable: r.stackable !== false }));
      saveCoupons(valid);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const applyCoupon = async (overrideCode?: string) => {
    const useCode = (overrideCode ?? code).trim();
    if (!useCode) return;
    if (coupons.some((c) => c.code.toLowerCase() === useCode.toLowerCase())) {
      setCouponMsg("That voucher is already applied.");
      return;
    }
    setChecking(true);
    setCouponMsg("");
    const res = await validateCoupon(useCode, subtotal, couponCtx, cartLines);
    setChecking(false);
    if (res.valid && res.discount != null) {
      if (stackConflict(res.stackable !== false, res.code!)) {
        setCouponMsg(
          res.stackable === false
            ? `${res.code} can't be combined with other vouchers. Remove the others first.`
            : "Your applied voucher can't be combined with others. Remove it first to use this one."
        );
        return;
      }
      saveCoupons([...coupons, { code: res.code!, discount: res.discount, couponId: res.couponId!, stackable: res.stackable !== false }]);
      setCouponMsg(`${res.code} applied!`);
      setCode("");
    } else {
      setCouponMsg(res.message);
    }
  };

  const cartProductIds = new Set(items.map((it) => it.product_id));
  // No voucher-unlock hints while a bundle is in the cart (coupons don't apply).
  const gap = !hasBundle(items) && nextVoucher ? nextVoucher.minOrder - subtotal : 0;
  // Suggest add-ons not already in the cart; surface ones that unlock the voucher first
  const suggested = useMemo(() => {
    const pool = suggestions.filter((p) => !cartProductIds.has(p.product_id));
    if (gap > 0) {
      pool.sort((a, b) => {
        const au = a.base_price >= gap ? 0 : 1;
        const bu = b.base_price >= gap ? 0 : 1;
        return au - bu || a.base_price - b.base_price;
      });
    }
    return pool.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, items, gap]);

  const addSuggestion = (p: SuggestionProduct) => {
    addItem({ product_id: p.product_id, name: p.name, image: p.image_url, price: p.base_price });
  };

  const removeCoupon = (codeToRemove: string) => {
    saveCoupons(coupons.filter((c) => c.code !== codeToRemove));
    setCouponMsg("");
  };

  const [stockMsg, setStockMsg] = useState("");
  const [checkingStock, setCheckingStock] = useState(false);

  // Re-validate the whole cart against the live catalogue before leaving: price,
  // name, availability and stock. If anything changed, update the cart and keep
  // them here to review; otherwise continue to checkout.
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

  // Bundles include free delivery and block coupons (they're their own deal).
  const bundlePresent = hasBundle(items);
  const couponDiscount = bundlePresent ? 0 : Math.min(coupons.reduce((s, c) => s + c.discount, 0), subtotal);
  const total = Math.max(0, subtotal - couponDiscount);
  const totalSaved = cartSavings(items); // Box of 5 product savings

  // ₦500 Classic Pancake Stack upgrade — a SEPARATE offer for full-price baskets only.
  // Unlocked by ₦15,000+ of full-price items, and NEVER shown when a bundle is in
  // the cart (a bundle is already discounted — no stacking the upgrade on top).
  const upgradeInCart = items.some((it) => it.upgrade);
  const fullPriceBase = fullPriceSubtotal(items);
  const upgradeEligible = !bundlePresent && fullPriceBase >= UPGRADE_MIN;
  const [upgradeProduct, setUpgradeProduct] = useState<{ base_price: number; image_url: string | null } | null>(null);
  useEffect(() => {
    supabase
      .from("diamond_products")
      .select("base_price, image_url, stock_level, active")
      .eq("product_id", UPGRADE_PRODUCT_ID)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.active !== false && (data.stock_level === null || data.stock_level > 0)) {
          setUpgradeProduct({ base_price: data.base_price, image_url: data.image_url });
        }
      });
  }, []);
  // Drop the upgrade if a bundle gets added, or the full-price basket falls back
  // below the ₦15,000 threshold.
  useEffect(() => {
    if (!upgradeInCart) return;
    if (bundlePresent || fullPriceBase < UPGRADE_MIN) {
      const up = items.find((it) => it.upgrade);
      if (up) removeItem(up.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundlePresent, fullPriceBase, upgradeInCart]);

  // Any product with "Show as Special Offer" switched on in /admin/products
  // gets a highlighted line here (strike-through price, savings, composition
  // line) — fetch which cart lines are flagged, and their live old_price /
  // offer_line, so admin edits show up here without a code change.
  const cartProductIdsKey = items.map((it) => it.product_id).sort().join(",");
  const [specialOfferMap, setSpecialOfferMap] = useState<Map<string, { old_price: number | null; offer_line: string | null }>>(new Map());
  useEffect(() => {
    if (!cartProductIdsKey) { setSpecialOfferMap(new Map()); return; }
    supabase
      .from("diamond_products")
      .select("product_id, old_price, offer_line")
      .eq("is_special_offer", true)
      .in("product_id", cartProductIdsKey.split(","))
      .then(({ data }) => {
        setSpecialOfferMap(new Map((data || []).map((p) => [p.product_id, { old_price: p.old_price, offer_line: p.offer_line }])));
      });
  }, [cartProductIdsKey]);

  const addUpgrade = () => {
    if (!upgradeProduct) return;
    addItem({
      product_id: UPGRADE_PRODUCT_ID,
      name: "Classic Pancake Stack",
      image: upgradeProduct.image_url,
      price: UPGRADE_PRICE,
      upgrade: true,
      worth: upgradeProduct.base_price,
    });
  };

  if (!ready) {
    return (
      <div className="flex justify-center py-40">
        <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-28 text-center">
        <span className="font-script text-5xl text-brand-primary/40">empty</span>
        <h1 className="font-display text-4xl md:text-5xl text-brand-dark mt-3">Your cart is empty</h1>
        <p className="font-sans text-sm text-brand-dark/60 mt-3">Time to add something sweet.</p>
        <Link
          href="/shop"
          className="inline-block mt-8 bg-brand-primary text-brand-light px-9 py-4 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all"
        >
          Browse menu
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-12 md:py-16">
      <h1 className="font-display text-4xl md:text-6xl text-brand-dark mb-6">
        Your <span className="font-script text-brand-primary font-normal">cart</span>
      </h1>

      <div className="mb-9">
        {bundlePresent ? (
          <div className="rounded-2xl p-4 sm:p-5 border bg-brand-primary/5 border-brand-primary/30">
            <p className="font-sans text-sm text-brand-dark">
              🚚 <span className="font-bold text-brand-primary">Free delivery</span> is included with your box.
            </p>
          </div>
        ) : (
          <FreeDeliveryBar subtotal={subtotal} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <AnimatePresence>
            {items.map((it) => {
              // Special Offer products (flagged in /admin/products) are normal
              // product lines — they don't carry `bundle`/`worth` — so compute
              // their strike-through/savings here, styled after the homepage
              // promo card so they stand out in the cart.
              const offerMeta = specialOfferMap.get(it.product_id);
              const isSpecialOffer = !!offerMeta;
              const offerCompareAtUnit = offerMeta?.old_price && offerMeta.old_price > it.price ? offerMeta.old_price : 0;
              const offerCompareTotal = offerCompareAtUnit * it.quantity;
              const offerSaving = isSpecialOffer ? Math.max(0, offerCompareTotal - it.price * it.quantity) : 0;
              const totalSaving = offerSaving > 0 ? offerSaving : lineSaving(it);
              const compareTotal = offerSaving > 0 ? offerCompareTotal : it.bundle ? it.bundle.worth : it.worth || 0;

              return (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-4 rounded-2xl p-4 ${
                  isSpecialOffer ? "bg-brand-primary/5 border-2 border-brand-primary/30" : "bg-brand-light border border-brand-line"
                }`}
              >
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-brand-blush shrink-0">
                  {it.image ? (
                    <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="font-script text-xl text-brand-primary/30">D</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-lg text-brand-dark leading-tight">{it.name}</h3>
                    {it.bundle && <Tag>Bundle</Tag>}
                    {it.upgrade && <Tag>Add-on</Tag>}
                    {isSpecialOffer && (
                      <span className="inline-flex items-center gap-1 bg-brand-primary-dark text-white font-sans text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full">
                        <span className="text-brand-dark">★</span> Special Offer
                      </span>
                    )}
                  </div>

                  {isSpecialOffer && offerMeta?.offer_line && (
                    <p className="font-sans text-[11px] font-bold tracking-wide text-brand-primary-dark uppercase mt-1.5">
                      {offerMeta.offer_line}
                    </p>
                  )}

                  {/* Bundle: list the picked flavours */}
                  {it.bundle && (
                    <p className="font-sans text-[12px] text-brand-dark/60 mt-1 leading-relaxed">
                      {it.bundle.components
                        .map((c) => `${c.quantity > 1 ? c.quantity + "× " : ""}${c.name}`)
                        .join(" · ")}
                    </p>
                  )}

                  {it.note && (
                    <p className="font-sans text-[12px] text-brand-dark/60 mt-1 leading-relaxed italic">
                      &ldquo;{it.note}&rdquo;
                    </p>
                  )}

                  <div className="flex items-baseline gap-2 mt-1.5">
                    <p className="font-sans text-lg font-semibold text-brand-plum">{formatNaira(it.price * it.quantity)}</p>
                    {totalSaving > 0 && (
                      <span className="font-sans text-[12px] text-brand-grey line-through">
                        {formatNaira(compareTotal)}
                      </span>
                    )}
                  </div>

                  {totalSaving > 0 && (
                    <p className="font-sans text-[12px] font-semibold text-brand-primary mt-0.5">
                      You save {formatNaira(totalSaving)}
                    </p>
                  )}

                  {/* Normal products get a quantity stepper; bundles & the upgrade are fixed at one. */}
                  {it.bundle ? (
                    <p className="font-sans text-[11px] text-brand-grey mt-3">{it.bundle.picks} items in this box · remove to rebuild.</p>
                  ) : it.upgrade ? (
                    <p className="font-sans text-[11px] text-brand-grey mt-3">Normally {formatNaira(it.worth || 0)} — one per order.</p>
                  ) : (
                    <div className="inline-flex items-center border border-brand-line rounded-full overflow-hidden mt-4">
                      <button onClick={() => updateQty(it.id, it.quantity - 1)} className="w-9 h-9 text-brand-primary hover:bg-brand-blush transition-colors text-lg leading-none">−</button>
                      <span className="w-10 text-center text-sm font-semibold tabular-nums">{it.quantity}</span>
                      <button onClick={() => updateQty(it.id, it.quantity + 1)} className="w-9 h-9 text-brand-primary hover:bg-brand-blush transition-colors text-lg leading-none">+</button>
                    </div>
                  )}
                </div>

                <button onClick={() => removeItem(it.id)} className="text-brand-grey hover:text-brand-primary transition-colors self-start shrink-0" aria-label="remove">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1 min-w-0">
          <div className="lg:sticky lg:top-28 space-y-5">
            {/* Voucher progress: sits right above the summary so it's seen at checkout.
                Hidden when a bundle is in the cart — coupons don't apply to bundles. */}
            {!bundlePresent && (nextVoucher ? (
              <div className="bg-brand-light border border-brand-primary/25 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <svg className="w-5 h-5 text-brand-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 5z" />
                  </svg>
                  <p className="font-sans text-sm text-brand-dark">
                    You&apos;re <span className="font-bold text-brand-primary">{formatNaira(gap)}</span> away from <span className="font-bold">{nextVoucher.discountLabel}</span>
                    <span className="text-brand-grey"> with </span><span className="font-bold tracking-wide">{nextVoucher.code}</span>
                  </p>
                </div>
                <div className="h-2.5 bg-brand-paper rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-primary to-brand-plum rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((subtotal / nextVoucher.minOrder) * 100))}%` }}
                  />
                </div>
              </div>
            ) : unlockedVoucher ? (
              <div className="bg-brand-primary/5 border border-brand-primary/30 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3">
                <p className="font-sans text-sm text-brand-dark">
                  🎉 You&apos;ve unlocked <span className="font-bold text-brand-primary">{unlockedVoucher.discountLabel}</span>: <span className="font-bold tracking-wide">{unlockedVoucher.code}</span>
                </p>
                <button
                  onClick={() => applyCoupon(unlockedVoucher.code)}
                  className="shrink-0 bg-brand-primary text-brand-light px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-brand-primary-dark transition-colors"
                >
                  Apply
                </button>
              </div>
            ) : null)}

            {/* ₦500 Classic Pancake Stack upgrade — unlocked by a ₦15,000+ full-price basket */}
            {upgradeEligible && !upgradeInCart && upgradeProduct && (
              <div className="bg-gradient-to-br from-brand-primary/10 to-brand-blush border border-brand-primary/30 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-brand-blush shrink-0">
                  {upgradeProduct.image_url && <img src={upgradeProduct.image_url} alt="Classic Pancake Stack" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-[13px] font-bold text-brand-dark leading-tight">Add a Classic Pancake Stack for ₦500</p>
                  <p className="font-sans text-[11px] text-brand-grey mt-0.5">Normally {formatNaira(upgradeProduct.base_price)} — save {formatNaira(upgradeProduct.base_price - UPGRADE_PRICE)}.</p>
                </div>
                <button onClick={addUpgrade} className="shrink-0 bg-brand-primary text-brand-light px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-brand-primary-dark transition-colors">Add</button>
              </div>
            )}

          <div className="bg-brand-light border border-brand-line rounded-2xl p-6">
            <h2 className="font-display text-2xl text-brand-dark mb-5">Order summary</h2>

            {/* Coupons: stack as many as apply — but never alongside a bundle. */}
            {bundlePresent ? (
              <div className="mb-5 rounded-xl bg-brand-cream border border-brand-line px-4 py-3">
                <p className="font-sans text-[12px] text-brand-dark/70 leading-relaxed">
                  🎁 Your box is already discounted, so coupon codes don&apos;t apply. Remove the box to use a voucher.
                </p>
              </div>
            ) : (
            <div className="mb-5">
              {coupons.length > 0 && (
                <div className="space-y-2 mb-3">
                  {coupons.map((c) => (
                    <div key={c.code} className="flex items-center justify-between bg-brand-primary/5 border border-brand-primary/30 rounded-xl px-4 py-3">
                      <div>
                        <span className="font-sans text-xs font-bold text-brand-primary tracking-widest uppercase">{c.code}</span>
                        <span className="block font-sans text-[11px] text-brand-grey">−{formatNaira(c.discount)} applied</span>
                      </div>
                      <button onClick={() => removeCoupon(c.code)} className="text-brand-grey hover:text-brand-primary text-[10px] font-bold uppercase tracking-widest">Remove</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyCoupon(); }}
                  placeholder="Coupon code"
                  className="flex-1 min-w-0 bg-brand-cream border border-brand-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary transition-colors uppercase"
                />
                <button
                  onClick={() => applyCoupon()}
                  disabled={checking || !code.trim()}
                  className="px-4 py-2.5 bg-brand-plum text-brand-light rounded-xl font-sans text-[10px] font-bold tracking-widest uppercase hover:bg-brand-plum-dark transition-colors disabled:opacity-40 shrink-0"
                >
                  {checking ? "…" : "Apply"}
                </button>
              </div>
              {couponMsg && <p className={`text-[11px] mt-2 ${couponMsg.includes("applied!") ? "text-green-600" : "text-brand-primary"}`}>{couponMsg}</p>}

              {/* Available vouchers trigger: always available so more can be added */}
              <button
                onClick={() => setVouchersOpen(true)}
                className="mt-3 w-full flex items-center justify-center gap-2 text-brand-primary border border-dashed border-brand-primary/40 rounded-xl py-2.5 text-[11px] font-bold tracking-[0.14em] uppercase hover:bg-brand-primary/5 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 010 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 010-4V7a2 2 0 00-2-2H5z" />
                </svg>
                {coupons.length > 0 ? "Add another voucher" : "See available vouchers"}
              </button>
            </div>
            )}

            <div className="space-y-2.5 border-t border-brand-line pt-5">
              <Row label="Subtotal" value={formatNaira(subtotal)} />
              {couponDiscount > 0 && <Row label="Discount" value={`−${formatNaira(couponDiscount)}`} accent />}
              {bundlePresent
                ? <Row label="Delivery" value="Free" accent />
                : <p className="text-[11px] text-brand-grey">Delivery calculated at checkout.</p>}
              <div className="flex justify-between items-baseline pt-3 border-t border-brand-line mt-3">
                <span className="font-sans font-semibold text-brand-dark">Total</span>
                <span className="font-display text-2xl text-brand-primary">{formatNaira(total)}</span>
              </div>
              {(totalSaved > 0 || bundlePresent) && (
                <div className="mt-3 rounded-xl bg-brand-primary/5 border border-brand-primary/25 px-3.5 py-2.5 text-center">
                  <span className="block font-sans text-[12px] font-semibold text-brand-primary">
                    🎁 {totalSaved > 0 ? `Saving ${formatNaira(totalSaved)} + free delivery` : "Free delivery included with your box"}
                  </span>
                  <span className="block font-sans text-[10px] text-brand-dark/50 mt-0.5">⏳ Today&apos;s price — bundle prices may go up soon</span>
                </div>
              )}
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
            <Link href="/shop" className="block text-center mt-4 text-brand-grey hover:text-brand-primary text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors">
              Continue shopping
            </Link>
          </div>
          </div>
        </div>
      </div>

      {/* You might like: quick add-ons (helps cross a voucher threshold) */}
      {suggested.length > 0 && (
        <div className="mt-16">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-display text-2xl md:text-3xl text-brand-dark">You might like</h2>
            {gap > 0 && <span className="font-sans text-[11px] text-brand-grey hidden sm:block">Add a little something to unlock {nextVoucher?.discountLabel}</span>}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {suggested.map((p) => {
              const unlocks = gap > 0 && p.base_price >= gap;
              return (
                <div key={p.product_id} className="bg-brand-light border border-brand-line rounded-2xl overflow-hidden flex flex-col">
                  <Link href={`/product/${p.product_id}`} className="block aspect-square bg-brand-blush overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><span className="font-script text-2xl text-brand-primary/30">D</span></div>
                    )}
                  </Link>
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="font-sans text-[13px] font-semibold text-brand-dark leading-tight line-clamp-2 min-h-[2.4em]">{p.name}</h3>
                    {unlocks && <span className="mt-1 inline-block self-start text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary">Unlocks voucher</span>}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span className="font-sans text-sm font-semibold text-brand-plum">{formatNaira(p.base_price)}</span>
                      <button
                        onClick={() => addSuggestion(p)}
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
      )}

      {/* Available vouchers modal */}
      <AnimatePresence>
        {vouchersOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setVouchersOpen(false)} className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="relative w-full max-w-md bg-brand-cream rounded-3xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="px-6 py-5 flex justify-between items-center border-b border-brand-line shrink-0">
                <div>
                  <h3 className="font-display text-2xl text-brand-dark leading-none">Vouchers</h3>
                  <p className="font-sans text-[11px] text-brand-grey mt-1">Tap one to apply it to your order</p>
                </div>
                <button onClick={() => setVouchersOpen(false)} className="text-brand-dark/40 hover:text-brand-primary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-3">
                {loadingVouchers ? (
                  <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
                ) : vouchers.length === 0 ? (
                  <p className="text-center py-12 font-sans text-sm text-brand-grey">No vouchers available right now.</p>
                ) : (
                  vouchers.map((v) => {
                    const isApplied = coupons.some((c) => c.code === v.code);
                    const stackBlocked = !isApplied && stackConflict(v.stackable, v.code);
                    return v.applicable && !stackBlocked ? (
                      <button
                        key={v.id}
                        onClick={() => (isApplied ? removeCoupon(v.code) : applyCoupon(v.code))}
                        className={`w-full text-left relative border rounded-2xl p-4 transition-colors ${isApplied ? "border-brand-primary bg-brand-primary/5" : "border-brand-primary/30 bg-brand-light hover:border-brand-primary hover:bg-brand-primary/5"}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-display text-xl tracking-wide text-brand-primary">{v.code}</span>
                              <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary">{v.discountLabel}</span>
                            </div>
                            {v.description && <p className="font-sans text-[12px] text-brand-dark/70 mt-1">{v.description}</p>}
                            {v.requirement && <p className="font-sans text-[11px] text-brand-grey mt-1">{v.requirement}</p>}
                          </div>
                          <span className={`shrink-0 px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase whitespace-nowrap ${isApplied ? "bg-brand-primary/10 text-brand-primary" : "bg-brand-primary text-brand-light"}`}>{isApplied ? "Applied ✓" : "Apply"}</span>
                        </div>
                      </button>
                    ) : (
                      <div
                        key={v.id}
                        className="relative border border-brand-line bg-brand-light/50 rounded-2xl p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-display text-xl tracking-wide text-brand-dark/40">{v.code}</span>
                              <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-brand-line text-brand-dark/40">{v.discountLabel}</span>
                            </div>
                            {v.description && <p className="font-sans text-[12px] text-brand-dark/70 mt-1">{v.description}</p>}
                            {v.requirement && <p className="font-sans text-[11px] text-brand-grey mt-1">{v.requirement}</p>}
                          </div>
                          <span className="shrink-0 text-[10px] font-semibold text-brand-dark/45 bg-brand-paper px-3 py-2 rounded-full whitespace-nowrap">{stackBlocked ? "Can't combine" : v.reason}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="font-sans text-[10px] tracking-wide uppercase text-brand-dark/50 bg-brand-cream px-2 py-0.5 rounded-full">{children}</span>;
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-brand-dark/60">{label}</span>
      <span className={accent ? "text-brand-primary font-semibold" : "text-brand-dark font-medium"}>{value}</span>
    </div>
  );
}
