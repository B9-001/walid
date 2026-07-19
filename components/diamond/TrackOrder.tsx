"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { formatNaira } from "@/lib/format";
import OrderStatus from "@/components/diamond/OrderStatus";
import type { Order } from "@/lib/types";

const statusBadge: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  baking: "bg-purple-100 text-purple-700",
  ready: "bg-teal-100 text-teal-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

export default function TrackOrder() {
  const { user } = useAuth();
  const params = useSearchParams();
  const presetOrder = params.get("order") || "";

  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);

  const [orderNo, setOrderNo] = useState(presetOrder);
  const [result, setResult] = useState<Order | null>(null);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState("");

  // Load the signed-in customer's own orders
  useEffect(() => {
    if (!user) { setMyOrders([]); return; }
    setLoadingMine(true);
    supabase
      .from("diamond_orders")
      .select("*")
      .or(`customer_id.eq.${user.id},customer_email.eq.${user.email}`)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setMyOrders((data as Order[]) || []); setLoadingMine(false); });
  }, [user]);

  // Auto-open a specific order passed via ?order= (e.g. straight from checkout)
  useEffect(() => {
    if (!presetOrder) return;
    supabase
      .from("diamond_orders")
      .select("*")
      .eq("order_number", presetOrder.trim().toUpperCase())
      .maybeSingle()
      .then(({ data }) => { if (data) setResult(data as Order); });
  }, [presetOrder]);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    const num = orderNo.trim().toUpperCase();
    if (!num) { setError("Please enter your order ID."); return; }
    setLooking(true);

    // Track with just the order ID — no email needed
    const { data } = await supabase
      .from("diamond_orders")
      .select("*")
      .eq("order_number", num)
      .maybeSingle();
    if (data) setResult(data as Order);
    else setError("No order found with that ID. Please check and try again.");
    setLooking(false);
  };

  return (
    <div className="max-w-[760px] mx-auto px-6 py-16 md:py-24">
      <div className="text-center mb-10">
        <span className="eyebrow">Order tracking</span>
        <h1 className="font-display text-4xl md:text-6xl text-brand-dark mt-3">
          Track your <span className="font-script text-brand-primary font-normal">order</span>
        </h1>
        <p className="font-sans text-sm text-brand-dark/60 mt-3 max-w-md mx-auto">
          Enter your order ID to see exactly where your treats are.
        </p>
      </div>

      {/* Result detail */}
      {result ? (
        <div>
          <button
            onClick={() => { setResult(null); setError(""); }}
            className="inline-flex items-center gap-1.5 text-brand-dark/50 hover:text-brand-primary transition-colors text-[11px] font-semibold tracking-widest uppercase mb-5"
          >
            ← {user && myOrders.length ? "All my orders" : "Track another"}
          </button>

          <div className="bg-brand-light border border-brand-line rounded-2xl p-6 md:p-7">
            <div className="flex items-center justify-between gap-3 border-b border-brand-line pb-5 mb-6">
              <div>
                <p className="font-sans text-[10px] tracking-widest uppercase text-brand-dark/40">Order ID</p>
                <p className="font-display text-2xl text-brand-primary tracking-wide">{result.order_number}</p>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${statusBadge[result.status] || "bg-gray-100 text-gray-600"}`}>
                {result.status}
              </span>
            </div>

            <OrderStatus status={result.status} method={result.delivery_method} />

            {/* Summary */}
            <div className="border-t border-brand-line mt-6 pt-6">
              <h3 className="font-display text-lg text-brand-dark mb-4">Summary</h3>
              <div className="space-y-3">
                {(result.items || []).map((it, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-sans text-sm font-semibold text-brand-dark">{it.name}</p>
                      <p className="font-sans text-[11px] text-brand-grey">×{it.quantity}</p>
                    </div>
                    <span className="font-sans text-sm font-semibold text-brand-plum whitespace-nowrap">
                      {formatNaira(it.price * it.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-brand-line mt-4 pt-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-brand-dark/60">Subtotal</span><span>{formatNaira(result.subtotal)}</span></div>
                {result.coupon_discount > 0 && (
                  <div className="flex justify-between"><span className="text-brand-dark/60">Discount</span><span className="text-brand-primary">−{formatNaira(result.coupon_discount)}</span></div>
                )}
                <div className="flex justify-between">
                  <span className="text-brand-dark/60">{result.delivery_method === "pickup" ? "Pickup" : `Delivery${result.customer_city ? ` · ${result.customer_city}` : ""}`}</span>
                  <span>{result.delivery_fee === 0 ? "Free" : formatNaira(result.delivery_fee)}</span>
                </div>
                {result.service_fee > 0 && (
                  <div className="flex justify-between"><span className="text-brand-dark/60">Service fee</span><span>{formatNaira(result.service_fee)}</span></div>
                )}
                <div className="flex justify-between pt-2 border-t border-brand-line mt-2">
                  <span className="font-semibold text-brand-dark">Total</span>
                  <span className="font-display text-lg text-brand-primary">{formatNaira(result.total_price)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Signed-in customer's order list */}
          {user && (
            <div className="mb-10">
              <h2 className="font-display text-2xl text-brand-dark mb-4">Your orders</h2>
              {loadingMine ? (
                <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : myOrders.length === 0 ? (
                <p className="font-sans text-sm text-brand-grey py-8 text-center border border-dashed border-brand-line rounded-2xl">No orders yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {myOrders.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setResult(o)}
                      className="w-full flex items-center justify-between gap-4 bg-brand-light border border-brand-line rounded-xl px-5 py-4 hover:border-brand-primary/40 transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <p className="font-sans text-sm font-bold text-brand-primary tracking-wide">{o.order_number}</p>
                        <p className="font-sans text-[11px] text-brand-grey mt-0.5">{(o.items || []).length} item(s) · {formatNaira(o.total_price)}</p>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0 ${statusBadge[o.status] || "bg-gray-100 text-gray-600"}`}>
                        {o.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manual lookup */}
          <form onSubmit={lookup} className="bg-brand-light border border-brand-line rounded-2xl p-6 md:p-7">
            <h2 className="font-display text-xl text-brand-dark mb-4">
              {user ? "Look up another order" : "Find your order"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block font-sans text-[10px] label-track text-brand-dark/50 mb-2">Order ID</label>
                <input
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  placeholder="DT-XXXXXX"
                  className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-sm text-brand-dark focus:outline-none focus:border-brand-primary transition-colors uppercase tracking-wide"
                />
              </div>
              {error && <p className="font-sans text-[12px] text-brand-primary font-medium">{error}</p>}
              <button
                type="submit"
                disabled={looking}
                className="w-full bg-brand-primary text-brand-light py-3.5 rounded-full font-sans text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-brand-primary-dark transition-all disabled:opacity-60 mt-1"
              >
                {looking ? "Searching…" : "Track order"}
              </button>
            </div>
          </form>

          {!user && (
            <p className="text-center font-sans text-[12px] text-brand-dark/45 mt-5">
              Tip: <Link href="/" className="text-brand-primary underline">sign in</Link> to see all your orders in one place.
            </p>
          )}
        </>
      )}
    </div>
  );
}
