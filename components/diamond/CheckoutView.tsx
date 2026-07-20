"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { validateCoupon, incrementCouponUsage } from "@/lib/coupon";
import { payWithPaystack, generatePaymentRef, generateOrderNumber } from "@/lib/paystack";
import { attributeReferral } from "@/lib/referral";
import { getSource, getVisitorId, getFirstSource, getFirstSeen } from "@/lib/source";
import { isOfferMode, setOfferMode, OFFER_FREE_DELIVERY_MIN, serviceFeeFor } from "@/lib/offer";
import { hasBundle, cartSavings, expandForOrder } from "@/lib/bundles";
import { getShopStatus, DEFAULT_BUSINESS_HOURS, watTodayISO, addDaysISO, daySlots, isOpenDay, formatDateLabel } from "@/lib/hours";
import type { SiteSettings } from "@/lib/types";
import { fbTrack } from "@/lib/fbpixel";
import { trackCustomerEvent } from "@/lib/track";

const COUPON_KEY = "diamond_coupon";

export default function CheckoutView() {
  const { items, subtotal, clear, ready, reconcile } = useCart();
  const { user, openLogin } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<Partial<SiteSettings>>({});
  const [method, setMethod] = useState<"delivery" | "pickup">("delivery");
  const [deliveryAreas, setDeliveryAreas] = useState<{ id: string; location: string; fee: number }[]>([]);
  const [deliveryAreasLoaded, setDeliveryAreasLoaded] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [savedArea, setSavedArea] = useState<string>("");
  const [prefilled, setPrefilled] = useState(false);
  const [offerMode, setOfferModeState] = useState(false);

  // Detect the free-delivery offer funnel (no vouchers, free delivery over ₦20k)
  useEffect(() => { setOfferModeState(isOfferMode()); }, []);

  // Operating hours → open/closed status, plus same-day vs future-date scheduling.
  const hours = settings.business_hours || DEFAULT_BUSINESS_HOURS;
  const shop = useMemo(() => getShopStatus(hours), [hours]);
  const todayISO = useMemo(() => watTodayISO(), []);
  const canSameDay = shop.earliestIsToday; // today still within opening hours

  const [fulfilMode, setFulfilMode] = useState<"today" | "future">("future");
  const [futureDate, setFutureDate] = useState("");
  const [fulfilTime, setFulfilTime] = useState("");
  const [customTime, setCustomTime] = useState("");

  // Default to same-day when possible; otherwise future. Seed the future date.
  useEffect(() => { setFulfilMode(canSameDay ? "today" : "future"); }, [canSameDay]);
  useEffect(() => {
    if (!futureDate) setFutureDate(canSameDay ? addDaysISO(todayISO, 1) : shop.earliestDate);
  }, [canSameDay, shop.earliestDate, todayISO, futureDate]);

  const fulfilDate = fulfilMode === "today" ? todayISO : futureDate;
  const minFutureDate = canSameDay ? addDaysISO(todayISO, 1) : shop.earliestDate;
  const slots = useMemo(
    () => daySlots(hours, fulfilDate, { afterNow: fulfilMode === "today" }),
    [hours, fulfilDate, fulfilMode]
  );
  // Keep a valid slot selected as the day/slots change.
  useEffect(() => {
    if (slots.length && !slots.some((s) => s.value === fulfilTime)) setFulfilTime(slots[0].value);
    if (!slots.length) setFulfilTime("");
  }, [slots, fulfilTime]);

  const trimmedCustom = customTime.trim();
  const chosenTimeValue = trimmedCustom || fulfilTime; // saved to the order
  const chosenTimeLabel = trimmedCustom
    ? trimmedCustom
    : slots.find((s) => s.value === fulfilTime)?.label || "";
  const fulfilVerb = method === "pickup" ? "ready for pickup" : "delivered";
  const isPreorder = fulfilMode === "future" || (fulfilMode === "today" && !shop.isOpen);
  const fulfilDateLabel = formatDateLabel(fulfilDate);

  // Meta InitiateCheckout: fires once when the checkout loads with items.
  const [icFired, setICFired] = useState(false);
  useEffect(() => {
    if (ready && items.length > 0 && !icFired) {
      fbTrack("InitiateCheckout", {
        value: subtotal / 100, // kobo -> NGN
        currency: "NGN",
        num_items: items.reduce((n, i) => n + (i.quantity || 0), 0),
      });
      void trackCustomerEvent("checkout", { value: subtotal });
      setICFired(true);
    }
  }, [ready, items, subtotal, icFired]);
  const [coupons, setCoupons] = useState<{ code: string; discount: number; couponId: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    supabase
      .from("diamond_site_settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setSettings(data); });

    supabase
      .from("diamond_delivery_fees")
      .select("id, location, fee")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => { setDeliveryAreas(data || []); setDeliveryAreasLoaded(true); });

    try {
      const raw = localStorage.getItem(COUPON_KEY);
      if (raw) { const p = JSON.parse(raw); setCoupons(Array.isArray(p) ? p : [p]); }
    } catch {
      /* ignore */
    }
  }, []);

  // Pre-fill the form from a signed-in customer's saved delivery profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("diamond_customers")
      .select("full_name, phone, address, delivery_area")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setForm((f) => ({
          ...f,
          name: f.name || data?.full_name || "",
          email: f.email || user.email || "",
          phone: f.phone || data?.phone || "",
          address: f.address || data?.address || "",
        }));
        if (data?.delivery_area) setSavedArea(data.delivery_area);
        setPrefilled(true);
      });
  }, [user]);

  // Re-select their saved delivery area once the areas have loaded
  useEffect(() => {
    if (!savedArea || selectedAreaId || !deliveryAreas.length) return;
    const match = deliveryAreas.find((a) => a.location === savedArea);
    if (match) setSelectedAreaId(match.id);
  }, [savedArea, deliveryAreas, selectedAreaId]);

  // Bundles include FREE DELIVERY and block coupons (they're their own deal).
  // Otherwise vouchers apply and stack on top of the free-delivery offer.
  const bundlePresent = hasBundle(items);
  const couponCodes = bundlePresent ? "" : coupons.map((c) => c.code).join(", ");
  const discount = bundlePresent ? 0 : Math.min(coupons.reduce((s, c) => s + c.discount, 0), subtotal);
  const couponLabel = bundlePresent ? null : (couponCodes || null);
  const discountedSubtotal = Math.max(0, subtotal - discount);

  const selectedArea = deliveryAreas.find((a) => a.id === selectedAreaId) ?? null;

  // Free delivery for everyone (both funnels) once the order reaches ₦20,000.
  // Admin's free_delivery_threshold can lower the bar, never raise it.
  const freeThreshold = settings.free_delivery_threshold
    ? Math.min(settings.free_delivery_threshold, OFFER_FREE_DELIVERY_MIN)
    : OFFER_FREE_DELIVERY_MIN;

  const baseDeliveryFee = method === "pickup" ? 0 : (selectedArea?.fee ?? 0);
  // Bundles always include free delivery; otherwise it unlocks at the ₦20k threshold.
  const freeDelivery = method === "delivery" && (bundlePresent || subtotal >= freeThreshold);
  const deliveryFee = freeDelivery ? 0 : baseDeliveryFee;
  // Expensive far-area offset when delivery is free
  const serviceFee = freeDelivery ? serviceFeeFor(baseDeliveryFee) : 0;

  // Free delivery has a real value (the fee we waive) — count it in the savings shown.
  const deliverySaved = freeDelivery ? Math.max(0, baseDeliveryFee - serviceFee) : 0;
  const totalSaved = cartSavings(items) + (bundlePresent ? deliverySaved : 0);

  const total = discountedSubtotal + deliveryFee + serviceFee;

  if (!ready) {
    return (
      <div className="flex justify-center py-40">
        <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-[700px] mx-auto px-6 py-28 text-center">
        <h1 className="font-display text-4xl text-brand-dark">Nothing to check out</h1>
        <Link href="/shop" className="inline-block mt-6 bg-brand-primary text-brand-light px-8 py-3.5 rounded-full text-[11px] font-bold tracking-[0.2em] uppercase">
          Browse cakes
        </Link>
      </div>
    );
  }

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const validate = (): string | null => {
    if (!form.name.trim()) return "Please enter your name.";
    if (!form.email.trim() || !form.email.includes("@")) return "Please enter a valid email.";
    if (!form.phone.trim()) return "Please enter your phone number.";
    if (method === "delivery" && !selectedAreaId) return "Please select your delivery area.";
    if (method === "delivery" && !form.address.trim()) return "Please enter a delivery address.";
    if (fulfilMode === "future") {
      if (!futureDate) return "Please choose a date for your order.";
      if (futureDate <= todayISO) return "Please choose a future date.";
      if (!isOpenDay(hours, futureDate)) return "We're closed on that date. Please choose another.";
    }
    if (!chosenTimeValue) return `Please choose a ${method === "pickup" ? "pickup" : "delivery"} time (or type a custom time).`;
    return null;
  };

  const createOrder = async (paymentRef: string) => {
    // Flatten bundle lines into their real component slugs (fixed bundle price
    // prorated across them) so the stock trigger + webhook decrement each flavour.
    const orderItems = expandForOrder(items);

    const basePayload = {
      customer_id: user?.id ?? null,
      referral_source: getSource(),
      referral_origin: getFirstSource(),
      first_seen_at: getFirstSeen(),
      visitor_id: getVisitorId(),
      customer_name: form.name.trim(),
      customer_email: form.email.trim(),
      customer_phone: form.phone.trim(),
      customer_address: method === "delivery" ? form.address.trim() : null,
      customer_city: method === "delivery" ? (selectedArea?.location ?? null) : null,
      customer_state: method === "delivery" ? "Abuja" : null,
      delivery_method: method,
      delivery_fee: deliveryFee,
      service_fee: serviceFee,
      required_date: fulfilDate || shop.earliestDate || null,
      required_time: chosenTimeValue || null,
      items: orderItems,
      subtotal,
      coupon_code: couponLabel,
      coupon_discount: discount,
      total_price: total,
      status: "pending",
      payment_status: "paid",
      payment_reference: paymentRef,
      notes: form.notes.trim() || null,
    };

    // Insert with a random order number, retrying if it happens to collide
    // (order_number is a unique column → error code 23505).
    let orderNumber = "";
    let saved = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      orderNumber = generateOrderNumber();
      const { error: insertError } = await supabase
        .from("diamond_orders")
        .insert([{ order_number: orderNumber, ...basePayload }]);
      if (!insertError) { saved = true; break; }
      if (insertError.code !== "23505") throw insertError;
    }
    if (!saved) throw new Error(`Could not save your order. Please contact us with reference: ${paymentRef}`);

    // Capture the buyer as a customer/lead (even as a guest) so we keep their
    // details. Keyed by email; omitting user_id for guests preserves any existing
    // account link. Non-fatal if it fails.
    try {
      const lead: Record<string, unknown> = {
        email: form.email.trim().toLowerCase(),
        full_name: form.name.trim(),
        phone: form.phone.trim(),
        last_seen_at: new Date().toISOString(),
        // They just paid: take them out of the behaviour funnel entirely so they're
        // no longer tagged as viewed / abandoned cart / abandoned checkout and don't
        // receive recovery emails.
        last_viewed_at: null,
        last_added_at: null,
        last_added_product_id: null,
        last_added_product_name: null,
        last_checkout_at: null,
      };
      if (user?.id) lead.user_id = user.id;
      { const src = getSource(); if (src) lead.referral_source = src; }
      // Save delivery details to their profile so next time it's pre-filled
      if (method === "delivery") {
        lead.address = form.address.trim() || null;
        lead.city = selectedArea?.location ?? null;
        lead.state = "Abuja";
        lead.delivery_area = selectedArea?.location ?? null;
      }
      await supabase.from("diamond_customers").upsert(lead, { onConflict: "email" });
      // Attribute the referral so this paid order counts toward the referrer's reward
      await attributeReferral(form.email.trim(), user?.id ?? null);
    } catch {
      /* non-fatal */
    }

    for (const c of coupons) {
      try { await incrementCouponUsage(c.couponId); } catch { /* non-fatal */ }
    }

    // Best-effort confirmation email (edge function may not be deployed yet)
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      fetch(`${url}/functions/v1/diamond-send-order-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          order_number: orderNumber,
          name: form.name,
          email: form.email,
          phone: form.phone,
          method,
          required_date: fulfilDate || shop.earliestDate || null,
          required_time: chosenTimeValue || null,
          items: orderItems,
          subtotal,
          discount,
          delivery_fee: deliveryFee,
          total,
        }),
      }).catch(() => {});
    } catch {
      /* ignore */
    }

    setConfirmedOrder(orderNumber); // enables the manual fallback link on the overlay
    localStorage.removeItem(COUPON_KEY);
    setOfferMode(false); // offer funnel complete
    clear();
    router.push(`/order-success?order=${orderNumber}`);
  };

  const handlePay = async () => {
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);

    // Final confirmation before charging: re-fetch every product and reconcile
    // the cart (price, name, availability, stock). If anything changed we update
    // the cart, surface it, and stop so we never charge for stale details.
    const changes = await reconcile();
    if (changes.length) {
      setError(`Your cart was updated. ${changes.join(" ")} Please review your order and pay again.`);
      setSubmitting(false);
      return;
    }

    // Re-validate every voucher server-side before charging (skipped entirely
    // when a bundle is present — coupons don't apply to bundles).
    if (!bundlePresent && coupons.length) {
      const lines = items.map((it) => ({ product_id: it.product_id, price: it.price, quantity: it.quantity }));
      const checks = await Promise.all(coupons.map((c) => validateCoupon(c.code, subtotal, { userId: user?.id ?? null, email: user?.email ?? null }, lines)));
      const stillValid = coupons.filter((_, i) => checks[i].valid);
      if (stillValid.length !== coupons.length) {
        setCoupons(stillValid);
        if (stillValid.length) localStorage.setItem(COUPON_KEY, JSON.stringify(stillValid));
        else localStorage.removeItem(COUPON_KEY);
      }
    }

    // Unique reference for the Paystack transaction. The sequential, customer-
    // facing order number (DT-0001…) is assigned in createOrder once payment
    // succeeds, so abandoned checkouts don't burn order numbers.
    const paymentRef = generatePaymentRef();

    const itemsSummary = items.map((it) => `${it.quantity}× ${it.name}`).join(", ");
    const metadata = {
      // Structured copy of the whole order: survives on Paystack even if the
      // customer closes the tab before we finish saving it to our database.
      order: {
        items: expandForOrder(items).map((l) => ({ product_id: l.product_id, name: l.name, quantity: l.quantity, price: l.price })),
        subtotal,
        discount,
        coupon_code: couponLabel,
        delivery_method: method,
        delivery_area: method === "delivery" ? selectedArea?.location ?? null : null,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        delivery_address: method === "delivery" ? form.address.trim() : null,
        required_date: fulfilDate || shop.earliestDate || null,
        required_time: chosenTimeValue || null,
        total,
        notes: form.notes.trim() || null,
        referral_source: getSource(),
      },
      // custom_fields render on the Paystack dashboard + email receipt
      custom_fields: [
        { display_name: "Customer", variable_name: "customer_name", value: form.name.trim() },
        { display_name: "Phone", variable_name: "phone", value: form.phone.trim() },
        { display_name: "Fulfilment", variable_name: "method", value: method === "delivery" ? "Delivery" : "Pickup" },
        ...(method === "delivery"
          ? [
              { display_name: "Delivery Area", variable_name: "delivery_area", value: selectedArea?.location ?? "-" },
              { display_name: "Address", variable_name: "address", value: form.address.trim() },
            ]
          : []),
        { display_name: "Items", variable_name: "items", value: itemsSummary },
        { display_name: "Subtotal", variable_name: "subtotal", value: formatNaira(subtotal) },
        { display_name: "Delivery Fee", variable_name: "delivery_fee", value: deliveryFee ? formatNaira(deliveryFee) : "Free" },
        ...(serviceFee > 0
          ? [{ display_name: "Service Fee", variable_name: "service_fee", value: formatNaira(serviceFee) }]
          : []),
        ...(discount > 0
          ? [{ display_name: "Discount", variable_name: "discount", value: `−${formatNaira(discount)} (${couponCodes})` }]
          : []),
        { display_name: "Total Paid", variable_name: "total", value: formatNaira(total) },
        ...(form.notes.trim()
          ? [{ display_name: "Notes", variable_name: "notes", value: form.notes.trim() }]
          : []),
      ],
    };

    const result = payWithPaystack({
      email: form.email.trim(),
      amountKobo: total,
      reference: paymentRef,
      metadata,
      onSuccess: (ref) => {
        // Block the screen so they don't navigate away mid-save
        setProcessing(true);
        createOrder(ref).catch((e) => {
          setProcessing(false);
          setSubmitting(false);
          setError(e.message || "Payment succeeded but saving your order failed. Please contact us with your reference: " + ref);
        });
      },
      onClose: () => {
        setSubmitting(false);
        // Paystack's popup auto-closes and calls onSuccess a moment after showing
        // "Payment Successful" — but if the customer taps the X before that
        // happens, we land here instead with no order ever saved. Always give
        // them the reference so a real charge is never left untraceable.
        setError(
          `Payment window closed before we could confirm your order. If your card was charged, please contact us with this reference and we'll sort it out: ${paymentRef}. Otherwise, you can try paying again.`
        );
      },
    });

    if (!result.ok) {
      setError(result.error || "Could not start payment.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto px-6 md:px-10 py-12 md:py-16">
      <Script src="https://js.paystack.co/v1/inline.js" strategy="afterInteractive" />

      {/* Post-payment overlay — two phases: confirming (order still saving) →
          confirmed (saved, redirecting to the receipt). */}
      {processing && (
        <div className="fixed inset-0 z-[100] bg-brand-paper/95 backdrop-blur-sm flex flex-col items-center justify-center px-6 text-center">
          {!confirmedOrder ? (
            <>
              <div className="w-14 h-14 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
              <h2 className="font-display text-2xl text-brand-dark mt-7">Confirming your order…</h2>
              <p className="font-sans text-sm text-brand-grey mt-2.5 max-w-sm leading-relaxed">
                Please wait a moment while we confirm your order.{" "}
                <strong className="text-brand-dark">Don&apos;t close or refresh this page.</strong>
              </p>
              {/* indeterminate loading bar */}
              <div className="mt-6 w-64 h-1.5 rounded-full bg-brand-line overflow-hidden">
                <div className="h-full w-1/3 rounded-full bg-brand-primary animate-[loadbar_1.1s_ease-in-out_infinite]" />
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-brand-primary/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="font-display text-2xl text-brand-dark mt-7">Order confirmed</h2>
              <p className="font-sans text-sm text-brand-grey mt-2.5 max-w-sm leading-relaxed">
                Taking you to your receipt…
              </p>
              <Link
                href={`/order-success?order=${confirmedOrder}`}
                className="mt-6 inline-block bg-brand-primary text-brand-light px-8 py-3.5 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all"
              >
                Click here if you&apos;re not redirected
              </Link>
            </>
          )}
        </div>
      )}

      <h1 className="font-display text-4xl md:text-6xl text-brand-dark mb-6">
        Check <span className="font-script text-brand-primary font-normal">out</span>
      </h1>

      {/* Bundle carts: their own deal (free delivery, no coupons) */}
      {bundlePresent ? (
        <div className="mb-9 bg-brand-primary/5 border border-brand-primary/30 rounded-2xl p-4 sm:p-5">
          <p className="font-sans text-sm text-brand-dark">
            🎁 <span className="font-bold text-brand-primary">Free delivery</span> is included with your box.
          </p>
        </div>
      ) : offerMode ? (
        <div className="mb-9 bg-brand-primary/5 border border-brand-primary/30 rounded-2xl p-4 sm:p-5">
          <p className="font-sans text-sm text-brand-dark">
            🚚 {subtotal >= OFFER_FREE_DELIVERY_MIN ? (
              <><span className="font-bold text-brand-primary">FREE delivery</span> applied to this order.</>
            ) : (
              <>Spend <span className="font-bold text-brand-primary">{formatNaira(OFFER_FREE_DELIVERY_MIN - subtotal)}</span> more for <span className="font-bold">FREE delivery</span>.</>
            )}
          </p>
        </div>
      ) : !user && (
        <div className="mb-9 bg-brand-primary/5 border border-brand-primary/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="font-sans text-sm text-brand-dark">
            🎁 <span className="font-bold text-brand-primary">Sign up to get 10% off</span> your first order.
          </p>
          <button
            onClick={() => openLogin("signup")}
            className="shrink-0 self-start sm:self-auto bg-brand-primary text-brand-light px-5 py-2.5 rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-brand-primary-dark transition-colors"
          >
            Sign up
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Form */}
        <div className="lg:col-span-3 space-y-8 min-w-0">
          {/* Delivery method */}
          <div>
            <h2 className="font-display text-2xl text-brand-dark mb-4">How would you like it?</h2>
            <div className="grid grid-cols-2 gap-3">
              {(["delivery", "pickup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`py-4 rounded-2xl border font-sans text-sm font-semibold capitalize transition-all ${
                    method === m
                      ? "border-brand-primary bg-brand-primary/5 text-brand-primary"
                      : "border-brand-line text-brand-dark/60 hover:border-brand-primary/40"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {method === "pickup" && settings.pickup_address && (
              <p className="font-sans text-[12px] text-brand-grey mt-2">Pickup at: {settings.pickup_address}</p>
            )}

            {method === "delivery" && (
              <div className="mt-4">
                <label className="block font-sans text-[10px] label-track text-brand-dark/50 mb-2">Delivery area</label>
                {!deliveryAreasLoaded ? (
                  <p className="font-sans text-sm text-brand-grey">Loading areas…</p>
                ) : deliveryAreas.length === 0 ? (
                  <p className="font-sans text-sm text-brand-primary font-medium">
                    No delivery areas are set up yet — please choose Pickup instead, or contact us to arrange delivery.
                  </p>
                ) : (
                  <select
                    value={selectedAreaId}
                    onChange={(e) => setSelectedAreaId(e.target.value)}
                    className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm text-brand-dark focus:outline-none focus:border-brand-primary transition-colors"
                  >
                    <option value="">Select your area</option>
                    {deliveryAreas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.location}: {formatNaira(a.fee)}
                      </option>
                    ))}
                  </select>
                )}
                <p className="font-sans text-[12px] text-brand-grey mt-2">📍 We currently deliver within Abuja only.</p>
              </div>
            )}
          </div>

          {/* Fulfilment timing: same-day vs future date, with a time + custom-time option */}
          <div>
            <h2 className="font-display text-2xl text-brand-dark mb-4">When would you like it?</h2>

            <div className={`rounded-2xl border p-4 ${shop.isOpen ? "border-brand-primary/30 bg-brand-primary/5" : "border-brand-line bg-brand-cream"}`}>
              <p className="font-sans text-sm text-brand-dark flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${shop.isOpen ? "bg-green-500" : "bg-brand-grey"}`} />
                {shop.statusMessage}
              </p>
            </div>

            {/* Same-day vs future date */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                type="button"
                onClick={() => canSameDay && setFulfilMode("today")}
                disabled={!canSameDay}
                className={`py-3 rounded-2xl border text-sm font-semibold transition-all ${fulfilMode === "today" ? "border-brand-primary bg-brand-primary/5 text-brand-primary" : "border-brand-line text-brand-dark/60 hover:border-brand-primary/40"} ${!canSameDay ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                Same day
              </button>
              <button
                type="button"
                onClick={() => setFulfilMode("future")}
                className={`py-3 rounded-2xl border text-sm font-semibold transition-all ${fulfilMode === "future" ? "border-brand-primary bg-brand-primary/5 text-brand-primary" : "border-brand-line text-brand-dark/60 hover:border-brand-primary/40"}`}
              >
                Future date
              </button>
            </div>
            {!canSameDay && (
              <p className="font-sans text-[11px] text-brand-grey mt-2">Same-day isn&apos;t available right now, we&apos;re closed for today. Please choose a future date.</p>
            )}

            {/* Future date picker */}
            {fulfilMode === "future" && (
              <div className="mt-4">
                <label className="block font-sans text-[10px] label-track text-brand-dark/50 mb-2">Choose a date</label>
                <input
                  type="date"
                  value={futureDate}
                  min={minFutureDate}
                  onChange={(e) => setFutureDate(e.target.value)}
                  className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm text-brand-dark focus:outline-none focus:border-brand-primary transition-colors"
                />
              </div>
            )}

            {/* Time of day */}
            <div className="mt-4">
              <label className="block font-sans text-[10px] label-track text-brand-dark/50 mb-2">
                {method === "pickup" ? "Pickup time" : "Delivery time"}
              </label>
              {slots.length > 0 ? (
                <select
                  value={fulfilTime}
                  onChange={(e) => setFulfilTime(e.target.value)}
                  disabled={!!trimmedCustom}
                  className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm text-brand-dark focus:outline-none focus:border-brand-primary transition-colors disabled:opacity-50"
                >
                  {slots.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              ) : (
                <p className="font-sans text-[12px] text-brand-grey">No standard times left for this day. Request a time below.</p>
              )}
            </div>

            {/* Custom / outside-hours time */}
            <div className="mt-4">
              <label className="block font-sans text-[10px] label-track text-brand-dark/50 mb-2">Need a time outside our hours? (optional)</label>
              <input
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                placeholder="e.g. 8:30 PM"
                className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm text-brand-dark focus:outline-none focus:border-brand-primary transition-colors"
              />
              <p className="font-sans text-[11px] text-brand-grey mt-1.5">Type a time here and we&apos;ll use it. We&apos;ll confirm if it&apos;s outside our usual {method === "pickup" ? "pickup" : "delivery"} window.</p>
            </div>

            {chosenTimeLabel && (
              <p className="font-sans text-[12px] text-brand-grey mt-3">
                {isPreorder ? "🗓️ Pre-order: " : "✅ "}
                Your order will be {fulfilVerb} on <span className="font-semibold text-brand-dark">{fulfilDateLabel}</span> at <span className="font-semibold text-brand-dark">{chosenTimeLabel}</span>
                {trimmedCustom ? " (we'll confirm this time)." : "."}
              </p>
            )}
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className="font-display text-2xl text-brand-dark">Your details</h2>
              {user && prefilled && (
                <span className="font-sans text-[11px] text-brand-primary">✓ Saved details filled in. Edit if needed</span>
              )}
            </div>
            <Input label="Full name" value={form.name} onChange={(v) => set("name", v)} placeholder="Ada Obi" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="you@email.com" />
              <Input label="Phone" type="tel" value={form.phone} onChange={(v) => set("phone", v)} placeholder="080…" />
            </div>

            {method === "delivery" && (
              <Input label="Delivery address" value={form.address} onChange={(v) => set("address", v)} placeholder="House number, street, landmark…" />
            )}

            <div>
              <label className="block font-sans text-[10px] label-track text-brand-dark/50 mb-2">Order notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                placeholder="e.g. Chocolate sponge, blue &amp; gold theme, 'Happy 30th Temi' on the cake, nut allergy, deliver between 2 to 4pm…"
                className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm text-brand-dark focus:outline-none focus:border-brand-primary transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2 min-w-0">
          <div className="bg-brand-light border border-brand-line rounded-2xl p-6 lg:sticky lg:top-28">
            <h2 className="font-display text-2xl text-brand-dark mb-5">Your order</h2>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {items.map((it) => (
                <div key={it.id} className="flex gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-brand-blush shrink-0">
                    {it.image ? (
                      <img src={it.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="font-script text-base text-brand-primary/30">D</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[13px] font-semibold text-brand-dark leading-tight truncate">{it.name}</p>
                    <p className="font-sans text-[11px] text-brand-grey">×{it.quantity}</p>
                  </div>
                  <span className="font-sans text-[13px] font-semibold text-brand-plum whitespace-nowrap">
                    {formatNaira(it.price * it.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-brand-line mt-5 pt-5 space-y-2.5">
              <Row label="Subtotal" value={formatNaira(subtotal)} />
              {discount > 0 && <Row label={`Discount (${couponCodes})`} value={`−${formatNaira(discount)}`} accent />}
              {freeDelivery && deliverySaved > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-brand-dark/60">{selectedArea ? selectedArea.location : "Delivery"}</span>
                  <span className="text-brand-primary font-semibold">
                    <span className="line-through text-brand-grey font-normal mr-1.5">{formatNaira(baseDeliveryFee)}</span>Free
                  </span>
                </div>
              ) : (
                <Row
                  label={method === "pickup" ? "Pickup" : selectedArea ? selectedArea.location : "Delivery"}
                  value={method === "delivery" && !selectedAreaId ? "Select area" : deliveryFee === 0 ? "Free" : formatNaira(deliveryFee)}
                  accent={freeDelivery}
                />
              )}
              {serviceFee > 0 && <Row label="Service fee" value={formatNaira(serviceFee)} />}
              <div className="flex justify-between items-baseline pt-3 border-t border-brand-line mt-3">
                <span className="font-sans font-semibold text-brand-dark">Total</span>
                <span className="font-display text-2xl text-brand-primary">{formatNaira(total)}</span>
              </div>
              {(totalSaved > 0 || bundlePresent) && (
                <div className="mt-3 rounded-xl bg-brand-primary/5 border border-brand-primary/25 px-3.5 py-2.5 text-center">
                  <span className="block font-sans text-[12px] font-semibold text-brand-primary">
                    🎁 {totalSaved > 0
                      ? `You're saving ${formatNaira(totalSaved)}${bundlePresent && deliverySaved > 0 ? " (incl. free delivery)" : ""}`
                      : "Free delivery included with your box"}
                  </span>
                  {bundlePresent && <span className="block font-sans text-[10px] text-brand-dark/50 mt-0.5">⏳ Today&apos;s price — bundle prices may go up soon</span>}
                </div>
              )}
            </div>

            {chosenTimeLabel && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-cream border border-brand-line px-3.5 py-2.5">
                <span className="text-base leading-none">{isPreorder ? "🗓️" : "✅"}</span>
                <p className="font-sans text-[12px] text-brand-dark/80">
                  {isPreorder ? "Pre-order: " : ""}{method === "pickup" ? "Ready for pickup" : "Delivered"} on<span className="font-semibold">{fulfilDateLabel}</span> at <span className="font-semibold">{chosenTimeLabel}</span>
                </p>
              </div>
            )}

            {error && <p className="text-brand-primary text-sm font-medium mt-4">{error}</p>}

            <button
              onClick={handlePay}
              disabled={submitting}
              className="w-full mt-6 bg-brand-primary text-brand-light py-4 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all disabled:opacity-50"
            >
              {submitting ? "Processing…" : `Pay ${formatNaira(total)}`}
            </button>
            <p className="text-center text-[10px] text-brand-grey mt-3 tracking-wide">Secured by Paystack</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block font-sans text-[10px] label-track text-brand-dark/50 mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm text-brand-dark focus:outline-none focus:border-brand-primary transition-colors"
      />
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-brand-dark/60">{label}</span>
      <span className={accent ? "text-brand-primary font-semibold" : "text-brand-dark font-medium"}>{value}</span>
    </div>
  );
}
