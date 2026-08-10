"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatNaira, formatDate } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function AdminOverview() {
  const [stats, setStats] = useState({ products: 0, orders: 0, pending: 0, revenue: 0 });
  const [recent, setRecent] = useState<Order[]>([]);

  useEffect(() => {
    async function load() {
      const [products, orders, pending, paidOrders, recentOrders] = await Promise.all([
        supabase.from("diamond_products").select("id", { count: "exact", head: true }),
        supabase.from("diamond_orders").select("id", { count: "exact", head: true }),
        supabase.from("diamond_orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("diamond_orders").select("total_price").eq("payment_status", "paid"),
        supabase.from("diamond_orders").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      const revenue = (paidOrders.data || []).reduce((s, o) => s + (o.total_price || 0), 0);
      setStats({
        products: products.count || 0,
        orders: orders.count || 0,
        pending: pending.count || 0,
        revenue,
      });
      setRecent((recentOrders.data as Order[]) || []);
    }
    load();
  }, []);

  return (
    <div>
      <div className="mb-10 border-b border-brand-line pb-7">
        <h1 className="font-display text-4xl md:text-6xl text-brand-dark leading-none">Overview</h1>
        <p className="font-script text-2xl text-brand-primary mt-2">your puff puff &amp; pancakes at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Orders" value={String(stats.orders)} />
        <Stat label="Pending" value={String(stats.pending)} accent />
        <Stat label="Products" value={String(stats.products)} />
        <Stat label="Revenue (paid)" value={formatNaira(stats.revenue)} />
      </div>

      <div className="mt-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-2xl text-brand-dark">Recent orders</h2>
          <Link href="/admin/orders" className="text-brand-primary text-[10px] font-bold tracking-widest uppercase border-b border-brand-primary pb-0.5">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-brand-grey font-sans text-sm py-10 text-center border border-dashed border-brand-line rounded-2xl">No orders yet.</p>
        ) : (
          <div className="space-y-2.5">
            {recent.map((o) => (
              <Link key={o.id} href="/admin/orders" className="flex items-center justify-between gap-4 bg-brand-light border border-brand-line rounded-xl px-5 py-4 hover:border-brand-primary/40 transition-colors">
                <div className="min-w-0">
                  <p className="font-sans text-sm font-semibold text-brand-dark truncate">{o.customer_name}</p>
                  <p className="font-sans text-[11px] text-brand-grey">{o.order_number} · {formatDate(o.created_at?.slice(0, 10))}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-sans text-sm font-semibold text-brand-primary">{formatNaira(o.total_price)}</p>
                  <span className="font-sans text-[9px] uppercase tracking-widest text-brand-grey">{o.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`bg-brand-light border rounded-2xl p-6 flex flex-col gap-2 ${accent ? "border-brand-primary/40" : "border-brand-line"}`}>
      <span className="font-sans text-[10px] tracking-[0.15em] uppercase text-brand-dark/45 font-semibold">{label}</span>
      <span className={`font-display text-3xl md:text-4xl ${accent ? "text-brand-primary" : "text-brand-dark"}`}>{value}</span>
    </div>
  );
}
