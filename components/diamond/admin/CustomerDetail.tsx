"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { tagInfo } from "@/lib/segments";

const STAGES = [
  { id: "lead", label: "Lead" },
  { id: "new", label: "New customer" },
  { id: "repeat", label: "Repeat" },
  { id: "vip", label: "VIP" },
  { id: "at_risk", label: "At-risk" },
  { id: "lapsed", label: "Lapsed" },
];

export default function CustomerDetail({ customer, onClose, onUpdated }: { customer: any; onClose: () => void; onUpdated: () => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [sends, setSends] = useState<any[]>([]);
  const [stage, setStage] = useState<string>(customer.lifecycle_stage || "lead");
  const [savingStage, setSavingStage] = useState(false);

  const [showCompose, setShowCompose] = useState(false);
  const [mail, setMail] = useState({ subject: "", heading: "", body: "", buttonLabel: "", buttonUrl: "/shop" });
  const [sending, setSending] = useState(false);
  const [mailMsg, setMailMsg] = useState("");

  useEffect(() => {
    supabase
      .from("diamond_orders")
      .select("order_number, status, total_price, created_at")
      .eq("customer_email", customer.email)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setOrders(data || []));
    supabase
      .from("diamond_email_log")
      .select("subject, type, sent_at")
      .ilike("email", customer.email)
      .order("sent_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setSends(data || []));
  }, [customer.email]);

  const behaviour: string[] = [];
  if (customer.last_checkout_at) behaviour.push("Abandoned checkout");
  if (customer.last_added_at) behaviour.push("Added to cart");
  if (customer.last_viewed_at) behaviour.push("Viewed");

  const changeStage = async (next: string) => {
    setStage(next);
    setSavingStage(true);
    if (next === "auto") {
      await supabase.from("diamond_customers").update({ stage_locked: false }).eq("id", customer.id);
      await supabase.rpc("diamond_recompute_customer_stage", { p_email: customer.email });
    } else {
      await supabase.from("diamond_customers").update({ lifecycle_stage: next, stage_locked: true, stage_changed_at: new Date().toISOString() }).eq("id", customer.id);
    }
    setSavingStage(false);
    onUpdated();
  };

  const sendEmail = async () => {
    if (!mail.subject.trim() || !mail.heading.trim() || !mail.body.trim()) { setMailMsg("Subject, heading and body are required."); return; }
    setSending(true); setMailMsg("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const origin = window.location.origin;
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/diamond-broadcast-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          subject: mail.subject, heading: mail.heading, body: mail.body,
          buttonLabel: mail.buttonLabel.trim() || undefined,
          buttonUrl: mail.buttonLabel.trim() ? `${origin}${mail.buttonUrl}` : undefined,
          test: true, testEmail: customer.email,
        }),
      });
      const data = await res.json();
      setMailMsg(res.ok && data.ok ? `✓ Sent to ${customer.email}.` : (data.error || "Send failed."));
      if (res.ok && data.ok) setShowCompose(false);
    } catch (e: any) { setMailMsg(e.message || "Send failed."); }
    finally { setSending(false); }
  };

  const info = tagInfo(stage);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-brand-cream h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-brand-cream/95 backdrop-blur px-6 py-5 flex items-start justify-between border-b border-brand-line z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl text-brand-dark truncate">{customer.full_name || "No name"}</h2>
              {(() => {
                const a = customer.user_id
                  ? { label: "Member", cls: "bg-green-100 text-green-700" }
                  : (customer.orders_count ?? 0) > 0
                  ? { label: "Customer", cls: "bg-blue-100 text-blue-700" }
                  : { label: "Lead", cls: "bg-amber-100 text-amber-700" };
                return <span className={`shrink-0 text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${a.cls}`}>{a.label}</span>;
              })()}
            </div>
            <p className="text-[12px] text-brand-grey truncate">{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}</p>
          </div>
          <button onClick={onClose} className="text-brand-dark/40 hover:text-brand-primary shrink-0" aria-label="Close">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Orders" value={String(customer.orders_count ?? 0)} />
            <Stat label="Total spent" value={formatNaira(customer.total_spent || 0)} />
            <Stat label="Joined" value={customer.created_at ? new Date(customer.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"} />
            <Stat label="Last seen" value={customer.last_seen_at ? new Date(customer.last_seen_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"} />
          </div>

          {/* Stage / tag */}
          <div>
            <label className="block text-[10px] label-track text-brand-dark/50 mb-2">Pipeline stage {customer.stage_locked && <span className="text-brand-primary">(manually set)</span>}</label>
            <select value={stage} onChange={(e) => changeStage(e.target.value)} disabled={savingStage} className="w-full bg-brand-light border border-brand-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary disabled:opacity-50">
              {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              <option value="auto">↺ Auto (recompute from orders)</option>
            </select>
            {info && <p className="text-[11px] text-brand-dark/50 mt-2 leading-snug">{info.tagged}</p>}
            {behaviour.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {behaviour.map((t) => <span key={t} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary">{t}</span>)}
              </div>
            )}
          </div>

          {/* Send email */}
          <div>
            {!showCompose ? (
              <button onClick={() => setShowCompose(true)} className="w-full bg-brand-primary text-brand-light py-3 rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-brand-primary-dark transition-colors">
                ✉ Send this customer an email
              </button>
            ) : (
              <div className="bg-brand-light border border-brand-line rounded-2xl p-4 space-y-3">
                <input value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} placeholder="Subject" className={cls} />
                <input value={mail.heading} onChange={(e) => setMail({ ...mail, heading: e.target.value })} placeholder="Heading" className={cls} />
                <textarea value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} rows={4} placeholder="Body" className={`${cls} resize-none`} />
                <div className="grid grid-cols-2 gap-2">
                  <input value={mail.buttonLabel} onChange={(e) => setMail({ ...mail, buttonLabel: e.target.value })} placeholder="Button (optional)" className={cls} />
                  <input value={mail.buttonUrl} onChange={(e) => setMail({ ...mail, buttonUrl: e.target.value })} placeholder="/shop" className={cls} />
                </div>
                <div className="flex gap-2">
                  <button onClick={sendEmail} disabled={sending} className="flex-1 bg-brand-primary text-brand-light py-2.5 rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-brand-primary-dark disabled:opacity-50">{sending ? "Sending…" : "Send"}</button>
                  <button onClick={() => setShowCompose(false)} className="px-5 py-2.5 rounded-full text-[10px] font-bold tracking-widest uppercase border border-brand-line text-brand-dark/60">Cancel</button>
                </div>
              </div>
            )}
            {mailMsg && <p className={`text-[12px] mt-2 ${mailMsg.startsWith("✓") ? "text-green-600" : "text-brand-primary"}`}>{mailMsg}</p>}
          </div>

          {/* Orders */}
          <div>
            <h3 className="text-[10px] label-track text-brand-dark/50 mb-2">Recent orders</h3>
            {orders.length === 0 ? (
              <p className="text-[12px] text-brand-dark/40">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {orders.map((o) => (
                  <div key={o.order_number} className="flex items-center justify-between bg-brand-light border border-brand-line rounded-xl px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-brand-dark truncate">{o.order_number}</p>
                      <p className="text-[10px] text-brand-grey">{new Date(o.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {o.status}</p>
                    </div>
                    <span className="text-[12px] font-semibold text-brand-plum">{formatNaira(o.total_price || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email history — every email this customer has been sent */}
          <div>
            <h3 className="text-[10px] label-track text-brand-dark/50 mb-2">Emails sent {sends.length > 0 && <span className="text-brand-dark/30">({sends.length})</span>}</h3>
            {sends.length === 0 ? (
              <p className="text-[12px] text-brand-dark/40">No emails sent yet.</p>
            ) : (
              <div className="space-y-2">
                {sends.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 bg-brand-light border border-brand-line rounded-xl px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-brand-dark truncate">{s.subject || "(no subject)"}</p>
                      <p className="text-[10px] text-brand-grey">{emailTypeLabel(s.type)}</p>
                    </div>
                    <span className="text-[10px] text-brand-dark/40 shrink-0 text-right">{new Date(s.sent_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const cls = "w-full bg-brand-paper border border-brand-line rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-primary";

function emailTypeLabel(type?: string): string {
  switch (type) {
    case "sequence": return "Automated sequence";
    case "broadcast": return "Marketing broadcast";
    case "manual": return "Manual (one-off)";
    case "order_confirmation": return "Order confirmation";
    case "order_status": return "Order status update";
    default: return "Email";
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-light border border-brand-line rounded-xl px-3 py-2.5">
      <span className="block text-[9px] font-bold uppercase tracking-widest text-brand-dark/40">{label}</span>
      <span className="block text-sm font-semibold text-brand-dark mt-0.5 tabular-nums">{value}</span>
    </div>
  );
}
