"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import OrderStatus from "@/components/diamond/OrderStatus";
import { fbTrack } from "@/lib/fbpixel";
import type { Order } from "@/lib/types";

export default function OrderSuccess() {
  const params = useSearchParams();
  const orderNumber = params.get("order") || "";
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderNumber) {
      setLoading(false);
      return;
    }
    supabase
      .from("diamond_orders")
      .select("*")
      .eq("order_number", orderNumber)
      .maybeSingle()
      .then(({ data }) => {
        setOrder(data as Order | null);
        setLoading(false);
      });
  }, [orderNumber]);

  // Fire the Meta Purchase event once the order is loaded. event_id is keyed to
  // the order number so refreshes / pixel+CAPI are deduplicated.
  useEffect(() => {
    if (!order?.order_number) return;
    fbTrack(
      "Purchase",
      {
        value: (order.total_price || 0) / 100, // kobo -> NGN
        currency: "NGN",
        num_items: (order.items || []).reduce((n, i) => n + (i.quantity || 0), 0),
      },
      {
        eventId: `purchase_${order.order_number}`,
        email: order.customer_email,
        phone: order.customer_phone,
      },
    );
  }, [order]);

  if (loading) {
    return (
      <div className="flex justify-center py-40">
        <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[680px] mx-auto px-6 py-20 md:py-28 text-center">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14 }}
        className="w-20 h-20 rounded-full bg-brand-primary text-brand-light flex items-center justify-center mx-auto mb-8"
      >
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </motion.div>

      <span className="eyebrow">Order confirmed</span>
      <h1 className="font-display text-4xl md:text-6xl text-brand-dark mt-3">
        Thank you{order?.customer_name ? `, ${order.customer_name.split(" ")[0]}` : ""}!
      </h1>
      <p className="font-sans text-sm md:text-base text-brand-dark/70 mt-4 max-w-md mx-auto">
        We&apos;ve received your order and will be in touch shortly to confirm the details.
        A confirmation has been sent to your email.
      </p>

      {orderNumber && (
        <div className="inline-flex items-center gap-2 mt-6 bg-brand-blush rounded-full px-6 py-2.5">
          <span className="font-sans text-xs text-brand-dark/60">Order ID:</span>
          <span className="font-sans text-sm font-bold text-brand-primary tracking-wide">{orderNumber}</span>
        </div>
      )}

      {order && (
        <div className="mt-10 bg-brand-light border border-brand-line rounded-2xl p-6 text-left">
          <h2 className="font-display text-xl text-brand-dark mb-5">Order status</h2>
          <OrderStatus status={order.status} method={order.delivery_method} />
        </div>
      )}

      {order && (
        <div className="mt-6 bg-brand-light border border-brand-line rounded-2xl p-6 text-left">
          <h2 className="font-display text-xl text-brand-dark mb-4">Order summary</h2>
          <div className="space-y-3">
            {(order.items || []).map((it, i) => (
              <div key={i} className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-sans text-sm font-semibold text-brand-dark">{it.name}</p>
                  <p className="font-sans text-[11px] text-brand-grey">
                    ×{it.quantity}{it.flavor ? ` · ${it.flavor}` : ""}
                  </p>
                </div>
                <span className="font-sans text-sm font-semibold text-brand-plum whitespace-nowrap">
                  {formatNaira(it.price * it.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-brand-blush mt-4 pt-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-brand-dark/60">Subtotal</span><span>{formatNaira(order.subtotal)}</span></div>
            {order.coupon_discount > 0 && (
              <div className="flex justify-between"><span className="text-brand-dark/60">Discount</span><span className="text-brand-primary">−{formatNaira(order.coupon_discount)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-brand-dark/60">{order.delivery_method === "pickup" ? "Pickup" : "Delivery"}</span><span>{order.delivery_fee === 0 ? "Free" : formatNaira(order.delivery_fee)}</span></div>
            {order.service_fee > 0 && <div className="flex justify-between"><span className="text-brand-dark/60">Service fee</span><span>{formatNaira(order.service_fee)}</span></div>}
            <div className="flex justify-between pt-2 border-t border-brand-blush mt-2">
              <span className="font-semibold text-brand-dark">Total</span>
              <span className="font-display text-lg text-brand-primary">{formatNaira(order.total_price)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
        <Link
          href={`/track?order=${encodeURIComponent(orderNumber)}`}
          className="inline-block bg-brand-primary text-brand-light px-9 py-4 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all"
        >
          Track your order
        </Link>
        <Link
          href="/shop"
          className="inline-block border border-brand-line text-brand-dark px-9 py-4 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:border-brand-primary hover:text-brand-primary transition-all"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
