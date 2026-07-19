"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import CustomerDetail from "./CustomerDetail";

export default function CustomersTable() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const load = useCallback(() => {
    supabase
      .from("diamond_customers")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setCustomers(data);
        setLoading(false);
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = customers.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return c.email?.toLowerCase().includes(q) || c.full_name?.toLowerCase().includes(q);
  });

  const shortDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  // Member = has an account; Customer = bought but no account; Lead = neither.
  const acctTag = (c: any) =>
    c.user_id
      ? { label: "Member", cls: "bg-green-100 text-green-700" }
      : (c.orders_count ?? 0) > 0
      ? { label: "Customer", cls: "bg-blue-100 text-blue-700" }
      : { label: "Lead", cls: "bg-amber-100 text-amber-700" };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email…"
          className="flex-1 max-w-sm bg-brand-light border border-brand-line rounded-full px-5 py-2.5 text-sm focus:outline-none focus:border-brand-primary"
        />
        <span className="font-sans text-[11px] text-brand-dark/40 tracking-widest uppercase shrink-0">
          {customers.length} total
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="py-24 border-2 border-dashed border-brand-line rounded-2xl text-center">
          <p className="font-display text-2xl text-brand-dark/40">No customers yet.</p>
          <p className="font-sans text-sm text-brand-grey mt-2">They'll appear here once they sign in.</p>
        </div>
      ) : (
        <div className="border border-brand-line rounded-2xl overflow-hidden bg-brand-light">
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-5 py-3 bg-brand-paper border-b border-brand-line">
            <span className="w-8" />
            <span className="font-sans text-[10px] tracking-widest uppercase text-brand-dark/40">Customer</span>
            <span className="font-sans text-[10px] tracking-widest uppercase text-brand-dark/40 text-right w-28">Joined</span>
            <span className="font-sans text-[10px] tracking-widest uppercase text-brand-dark/40 text-right w-28">Last seen</span>
          </div>
          {visible.map((c, i) => {
            const initials = (c.full_name || c.email || "?")
              .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
            return (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                className={`grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-5 py-3.5 cursor-pointer hover:bg-brand-paper/60 transition-colors ${i !== visible.length - 1 ? "border-b border-brand-line" : ""}`}
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-blush shrink-0 flex items-center justify-center">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt={initials} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="font-sans text-[10px] font-bold text-brand-primary">{initials}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-sans text-sm font-medium text-brand-dark truncate">
                      {c.full_name || <span className="text-brand-dark/40 italic">No name</span>}
                    </p>
                    {(() => { const a = acctTag(c); return (
                      <span className={`shrink-0 text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${a.cls}`}>{a.label}</span>
                    ); })()}
                  </div>
                  <p className="font-sans text-[11px] text-brand-grey truncate">
                    {c.email}{c.phone ? ` · ${c.phone}` : ""}
                  </p>
                  {(c.address || c.city) && (
                    <p className="font-sans text-[11px] text-brand-dark/40 truncate">📍 {[c.address, c.city, c.state].filter(Boolean).join(", ")}</p>
                  )}
                  {(c.last_added_product_name || c.last_checkout_at || c.last_viewed_product_name) && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {c.last_checkout_at && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">💳 Started checkout · {shortDate(c.last_checkout_at)}</span>
                      )}
                      {c.last_added_product_name && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary">🛒 Added {c.last_added_product_name}{c.last_added_at ? ` · ${shortDate(c.last_added_at)}` : ""}</span>
                      )}
                      {c.last_viewed_product_name && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-line/40 text-brand-dark/60">👀 Viewed {c.last_viewed_product_name}{c.last_viewed_at ? ` · ${shortDate(c.last_viewed_at)}` : ""}</span>
                      )}
                    </div>
                  )}
                </div>
                <span className="font-sans text-[11px] text-brand-dark/50 text-right w-28 tabular-nums">
                  {c.created_at ? new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </span>
                <span className="font-sans text-[11px] text-brand-dark/50 text-right w-28 tabular-nums">
                  {c.last_seen_at ? new Date(c.last_seen_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <CustomerDetail
          customer={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { load(); }}
        />
      )}
    </div>
  );
}
