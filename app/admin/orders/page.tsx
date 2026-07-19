"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { formatNaira, formatDate } from "@/lib/format";
import { formatPreorderDate } from "@/lib/product";
import { getBundle } from "@/lib/bundles";
import type { Order, OrderItem } from "@/lib/types";

const STATUSES = ["pending", "confirmed", "baking", "ready", "completed", "cancelled"];

type BundleGroupItem = OrderItem & { label?: string };

// Split order items into bundle groups (by bundle slug) + loose single items so
// the admin sees exactly which bundle was bought and what's inside it.
function groupOrderItems(items: BundleGroupItem[]) {
  const bundles: Record<string, { slug: string; name: string; components: BundleGroupItem[]; subtotal: number }> = {};
  const singles: BundleGroupItem[] = [];
  for (const it of items || []) {
    if (it?.bundle) {
      const name = getBundle(it.bundle)?.name || it.bundle;
      const g = (bundles[it.bundle] ||= { slug: it.bundle, name, components: [], subtotal: 0 });
      // Strip the "BundleName: " prefix the checkout adds to each component.
      const label = typeof it.name === "string" && it.name.startsWith(name + ": ") ? it.name.slice(name.length + 2) : it.name;
      g.components.push({ ...it, label });
      g.subtotal += (it.price || 0) * (it.quantity || 1);
    } else {
      singles.push(it);
    }
  }
  return { bundles: Object.values(bundles), singles };
}

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  baking: "bg-purple-100 text-purple-700",
  ready: "bg-teal-100 text-teal-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);

  useEffect(() => { fetchOrders(); }, []);

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase.from("diamond_orders").select("*").order("created_at", { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("diamond_orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    setSelected((s) => (s && s.id === id ? { ...s, status } : s));
  }

  const visible = orders.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return o.customer_name?.toLowerCase().includes(q) || o.order_number?.toLowerCase().includes(q) || o.customer_email?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      <div className="border-b border-brand-line pb-7 mb-8">
        <h1 className="font-display text-4xl md:text-6xl text-brand-dark leading-none">Orders</h1>
        <p className="font-script text-2xl text-brand-primary mt-2">every sweet sale</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or ref…" className="flex-1 bg-brand-light border border-brand-line rounded-full px-5 py-2.5 text-sm focus:outline-none focus:border-brand-primary" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-brand-light border border-brand-line rounded-full px-5 py-2.5 text-sm focus:outline-none focus:border-brand-primary capitalize">
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>

      {!loading && orders.length > 0 && (() => {
        const counts: Record<string, number> = {};
        for (const o of orders) { const k = o.referral_source || "Direct"; counts[k] = (counts[k] || 0) + 1; }
        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return (
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="text-[10px] uppercase tracking-[0.18em] text-brand-dark/40 self-center mr-1">By source</span>
            {entries.map(([k, n]) => (
              <span key={k} className="text-[11px] px-2.5 py-1 rounded-full bg-brand-light border border-brand-line">
                <span className={k === "Direct" ? "text-brand-dark/45" : "text-brand-primary font-semibold"}>{k}</span>
                <span className="text-brand-dark/55"> · {n}</span>
              </span>
            ))}
          </div>
        );
      })()}

      {loading ? (
        <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : visible.length === 0 ? (
        <p className="text-center py-24 text-brand-grey font-sans text-sm uppercase tracking-widest">No orders found.</p>
      ) : (
        <div className="space-y-2.5">
          {visible.map((o) => (
            <button key={o.id} onClick={() => setSelected(o)} className="w-full flex items-center justify-between gap-4 bg-brand-light border border-brand-line rounded-xl px-5 py-4 hover:border-brand-primary/40 transition-colors text-left">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-sans text-sm font-semibold text-brand-dark truncate">{o.customer_name}</p>
                  {(o.items || []).some((it) => it?.bundle) && (
                    <span className="shrink-0 text-[8px] font-bold uppercase tracking-widest bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full">🎁 Bundle</span>
                  )}
                </div>
                <p className="font-sans text-[11px] text-brand-grey">{o.order_number} · {formatDate(o.created_at?.slice(0, 10))} · {(o.items || []).length} item(s)</p>
                {o.referral_source && <p className="font-sans text-[10px] text-brand-primary/80 mt-0.5 truncate">↪ via {o.referral_source}</p>}
                {(o.required_date || o.required_time) && (
                  <p className="font-sans text-[11px] text-brand-primary mt-0.5">
                    🗓 Wants it: {[o.required_date ? formatDate(String(o.required_date).slice(0, 10)) : null, o.required_time].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {o.notes && <span title="Has order notes" className="w-2 h-2 rounded-full bg-brand-primary shrink-0" />}
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${statusColor[o.status] || "bg-gray-100 text-gray-600"}`}>{o.status}</span>
                <span className="font-sans text-sm font-semibold text-brand-primary">{formatNaira(o.total_price)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 280 }} className="relative w-full max-w-md bg-brand-cream h-full overflow-y-auto">
              <div className="sticky top-0 bg-brand-cream border-b border-brand-line px-6 py-5 flex justify-between items-start z-10">
                <div>
                  <h3 className="font-display text-2xl text-brand-dark leading-none">{selected.customer_name}</h3>
                  <p className="font-sans text-[11px] text-brand-grey mt-1">{selected.order_number}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-brand-dark/40 hover:text-brand-primary"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>

              <div className="p-6 space-y-6">
                {/* Status selector */}
                <div>
                  <p className="text-[10px] label-track text-brand-dark/50 mb-2">Status</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.map((s) => (
                      <button key={s} onClick={() => updateStatus(selected.id, s)} className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all ${selected.status === s ? "bg-brand-primary text-brand-light" : "bg-brand-light border border-brand-line text-brand-dark/50 hover:border-brand-primary/40"}`}>{s}</button>
                    ))}
                  </div>
                </div>

                {/* Requested delivery/pickup date & time */}
                {(selected.required_date || selected.required_time) && (
                  <div className="bg-brand-primary/5 border border-brand-primary/30 rounded-2xl p-4">
                    <p className="text-[10px] label-track text-brand-primary/70 mb-1.5">{selected.delivery_method === "pickup" ? "Pickup" : "Delivery"} requested for</p>
                    <p className="font-sans text-sm font-semibold text-brand-dark">
                      {[selected.required_date ? formatDate(String(selected.required_date).slice(0, 10)) : null, selected.required_time].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                )}

                {/* Order notes */}
                {selected.notes ? (
                  <div className="bg-brand-blush border border-brand-primary/20 rounded-2xl p-4">
                    <p className="text-[10px] label-track text-brand-primary/70 mb-1.5">Order notes</p>
                    <p className="font-sans text-sm text-brand-dark leading-relaxed">{selected.notes}</p>
                  </div>
                ) : (
                  <div className="bg-brand-light border border-brand-line rounded-2xl p-4">
                    <p className="text-[10px] label-track text-brand-dark/30">No order notes</p>
                  </div>
                )}

                {/* Contact */}
                <div className="bg-brand-light border border-brand-line rounded-2xl p-5 space-y-1.5 text-sm">
                  <Detail label="Email" value={selected.customer_email} />
                  <Detail label="Phone" value={selected.customer_phone} />
                  <Detail label="Method" value={selected.delivery_method} />
                  {selected.delivery_method === "delivery" && <Detail label="Address" value={[selected.customer_address, selected.customer_city, selected.customer_state].filter(Boolean).join(", ")} />}
                  <Detail label="Payment" value={`${selected.payment_status}${selected.payment_reference ? ` · ${selected.payment_reference}` : ""}`} />
                  <Detail label="Came from" value={selected.referral_source || "Direct / untagged"} />
                </div>

                {/* Items */}
                {(() => {
                  const { bundles, singles } = groupOrderItems(selected.items || []);
                  return (
                    <div>
                      <p className="text-[10px] label-track text-brand-dark/50 mb-3">Items</p>
                      <div className="space-y-3">
                        {/* Bundle offers — grouped and clearly labelled */}
                        {bundles.map((b) => (
                          <div key={b.slug} className="rounded-xl border-2 border-brand-primary/40 bg-brand-primary/5 p-3">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <span className="inline-flex items-center gap-2 font-sans text-[12px] font-bold text-brand-primary">
                                🎁 {b.name}
                                <span className="text-[9px] font-bold uppercase tracking-widest bg-brand-primary text-brand-light px-2 py-0.5 rounded-full">Bundle</span>
                              </span>
                              <span className="font-sans text-[13px] font-semibold text-brand-plum whitespace-nowrap">{formatNaira(b.subtotal)}</span>
                            </div>
                            <div className="space-y-1.5 pl-1">
                              {b.components.map((c, i) => (
                                <div key={i} className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-md overflow-hidden bg-brand-blush shrink-0">{c.image && <img src={c.image} alt="" className="w-full h-full object-cover" />}</div>
                                  <p className="flex-1 min-w-0 font-sans text-[12px] text-brand-dark">{c.label} ×{c.quantity}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        {/* Regular single items */}
                        {singles.map((it, i) => (
                          <div key={i} className="flex gap-3 bg-brand-light border border-brand-line rounded-xl p-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-brand-blush shrink-0">{it.image && <img src={it.image} alt="" className="w-full h-full object-cover" />}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-sans text-[13px] font-semibold text-brand-dark">{it.name} ×{it.quantity}</p>
                              {it.upgrade && <p className="font-sans text-[11px] font-semibold text-brand-plum mt-0.5">🎁 ₦500 milkcake add-on</p>}
                              {it.preorder_release_at && (
                                <p className="font-sans text-[11px] font-semibold text-brand-plum mt-0.5">⏳ Pre-order · available {formatPreorderDate(it.preorder_release_at)}</p>
                              )}
                            </div>
                            <span className="font-sans text-[13px] font-semibold text-brand-plum whitespace-nowrap">{formatNaira(it.price * it.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Totals */}
                <div className="border-t border-brand-line pt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-brand-dark/60">Subtotal</span><span>{formatNaira(selected.subtotal)}</span></div>
                  {selected.coupon_discount > 0 && <div className="flex justify-between"><span className="text-brand-dark/60">Discount ({selected.coupon_code})</span><span className="text-brand-primary">−{formatNaira(selected.coupon_discount)}</span></div>}
                  <div className="flex justify-between"><span className="text-brand-dark/60">{selected.delivery_method === "pickup" ? "Pickup" : "Delivery"}</span><span>{selected.delivery_fee === 0 ? "Free" : formatNaira(selected.delivery_fee)}</span></div>
                  {selected.service_fee > 0 && <div className="flex justify-between"><span className="text-brand-dark/60">Service fee</span><span>{formatNaira(selected.service_fee)}</span></div>}
                  <div className="flex justify-between pt-2 border-t border-brand-line mt-2"><span className="font-semibold text-brand-dark">Total</span><span className="font-display text-lg text-brand-primary">{formatNaira(selected.total_price)}</span></div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <span className="text-brand-dark/50 capitalize shrink-0">{label}</span>
      <span className="text-brand-dark text-right break-words">{value}</span>
    </div>
  );
}
