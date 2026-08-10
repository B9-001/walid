"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

// Pipeline columns, left → right along the customer journey.
const STAGES = [
  { id: "lead", label: "Lead", accent: "text-brand-dark/50", dot: "bg-brand-dark/30" },
  { id: "new", label: "New", accent: "text-blue-600", dot: "bg-blue-500" },
  { id: "repeat", label: "Repeat", accent: "text-brand-primary", dot: "bg-brand-primary" },
  { id: "vip", label: "VIP", accent: "text-amber-600", dot: "bg-amber-500" },
  { id: "at_risk", label: "At-risk", accent: "text-orange-600", dot: "bg-orange-500" },
  { id: "lapsed", label: "Lapsed", accent: "text-red-600", dot: "bg-red-500" },
];

type Customer = {
  id: string;
  email: string;
  full_name: string | null;
  lifecycle_stage: string;
  orders_count: number;
  total_spent: number;
  last_checkout_at: string | null;
  last_added_at: string | null;
  last_viewed_at: string | null;
};

export default function PipelineBoard({ onEmailStage }: { onEmailStage: (stage: string) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("diamond_customers")
      .select("id, email, full_name, lifecycle_stage, orders_count, total_spent, last_checkout_at, last_added_at, last_viewed_at")
      .not("email", "is", null)
      .order("total_spent", { ascending: false })
      .then(({ data }) => {
        if (data) setCustomers(data as Customer[]);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
          {STAGES.map((stage) => {
            const inStage = customers.filter((c) => c.lifecycle_stage === stage.id);
            return (
              <div key={stage.id} className="shrink-0 w-72">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                    <h2 className={`font-sans text-xs font-black uppercase tracking-widest ${stage.accent}`}>{stage.label}</h2>
                    <span className="text-[11px] text-brand-dark/40 font-semibold">{inStage.length}</span>
                  </div>
                  {inStage.length > 0 && (
                    <button onClick={() => onEmailStage(stage.id)} className="text-[9px] font-bold uppercase tracking-widest text-brand-primary hover:underline">
                      Email →
                    </button>
                  )}
                </div>

                <div className="space-y-2.5 bg-brand-paper/60 rounded-2xl p-2.5 min-h-[120px]">
                  {inStage.length === 0 ? (
                    <p className="text-center text-[11px] text-brand-dark/30 py-8 uppercase tracking-widest font-bold">Empty</p>
                  ) : (
                    inStage.map((c) => <Card key={c.id} c={c} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Card({ c }: { c: Customer }) {
  const tags: string[] = [];
  if (c.last_checkout_at) tags.push("Abandoned checkout");
  if (c.last_added_at) tags.push("Added to cart");
  if (c.last_viewed_at) tags.push("Viewed");

  return (
    <div className="bg-brand-light border border-brand-line rounded-xl p-3">
      <p className="font-sans text-[13px] font-semibold text-brand-dark truncate">
        {c.full_name || <span className="text-brand-dark/40 italic">No name</span>}
      </p>
      <p className="font-sans text-[11px] text-brand-grey truncate">{c.email}</p>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-brand-dark/50 font-semibold tabular-nums">
        <span>{c.orders_count} order{c.orders_count === 1 ? "" : "s"}</span>
        {c.total_spent > 0 && <span>{formatNaira(c.total_spent)}</span>}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map((t) => (
            <span key={t} className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
