"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/format";

// Live view of the Resend-based email system: tiers + pipeline, the AI broadcast queue (each email
// expandable to read the FULL email + the AI's logged reasoning; sent ones show that reasoning against
// the real opens/clicks), the per-tier playbook the AI has learned, the automation flows, and recent
// sends. Read-only.

type Ai = {
  tier: string; subject: string; body: string | null; angle: string | null; reasoning: string | null;
  image: string | null; cta_label: string | null; cta_url: string | null;
  sent_at: string; created_at: string; scored: boolean;
  recipients: number; delivered: number; opened: number; clicked: number;
};
type Data = {
  pipeline: Record<string, number>;
  tiers: Record<string, number>;
  tierNames: Record<string, string>;
  recent: { to: string; subject: string; event: string; at: string }[];
  recentCounts: Record<string, number>;
  automations: { name: string; status: string }[];
  ai: Ai[];
  learnings: { tier: string; playbook: string | null; emails_learned: number; updated_at: string }[];
  now: string;
};

const STAGES = ["lead", "new", "repeat", "vip", "at_risk", "lapsed"];
const STAGE_LABEL: Record<string, string> = { lead: "Lead", new: "New", repeat: "Repeat", vip: "VIP", at_risk: "At-risk", lapsed: "Lapsed", none: "Unstaged" };
const FLOW_LABEL: Record<string, string> = { lead: "Lead", new: "New customer", repeat: "Repeat", vip: "VIP", at_risk: "At-risk", lapsed: "Lapsed", cart: "Abandoned cart", viewed: "Viewed product", checkout: "Abandoned checkout" };
const EVENT_COLOR: Record<string, string> = { delivered: "text-green-600", opened: "text-blue-600", clicked: "text-brand-primary", bounced: "text-red-500", failed: "text-red-500", complained: "text-red-500", queued: "text-brand-dark/40", sent: "text-brand-dark/60" };
const TIER_TAG: Record<string, string> = { tier1: "Tier 1", tier2: "Tier 2", tier3: "Tier 3" };
const PIMG = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/diamond-products/products/`;

const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "·");
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();
const preview = (body: string | null) => (body || "").replace(/\{first_name\}/gi, "there").split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-brand-line rounded-2xl p-4">
      <div className="text-[10px] font-bold tracking-widest uppercase text-brand-dark/50">{label}</div>
      <div className="text-2xl font-display text-brand-dark mt-1 leading-none">{value}</div>
      {sub && <div className="text-[11px] text-brand-dark/50 mt-1">{sub}</div>}
    </div>
  );
}

// One email in the queue: header row always visible; click to expand the reasoning + the actual email.
function AiCard({ b, open, onToggle }: { b: Ai; open: boolean; onToggle: () => void }) {
  const isSent = b.scored;
  return (
    <div className="border border-brand-line rounded-2xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-brand-line/20 transition-colors">
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary whitespace-nowrap">{TIER_TAG[b.tier] || b.tier}</span>
        <span className="flex-1 min-w-0 text-sm text-brand-dark truncate">
          {b.subject}
          {sameDay(b.created_at, new Date().toISOString()) && <span className="ml-2 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary align-middle">new today</span>}
        </span>
        {isSent ? (
          <span className="text-[11px] whitespace-nowrap text-brand-dark/60"><span className="text-blue-600">{b.opened}</span> opens · <span className="text-brand-primary font-semibold">{b.clicked}</span> clicks</span>
        ) : (
          <span className="text-[11px] whitespace-nowrap text-brand-dark/50">{b.recipients} people · {when(b.sent_at)}</span>
        )}
        <span className="text-brand-dark/40 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-brand-line/60 space-y-4">
          {/* The AI's theory for this email */}
          <div className="rounded-xl bg-brand-line/20 p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/50 mb-1">Why the AI wrote it this way{b.angle ? ` · ${b.angle}` : ""}</div>
            <p className="text-[13px] text-brand-dark/80 leading-relaxed">{b.reasoning || "(no reasoning logged for this one)"}</p>
            {isSent && (
              <p className="text-[12px] mt-2 text-brand-dark/60">
                Result: delivered {b.delivered}, <span className="text-blue-600">{b.opened} opened</span>, <span className="text-brand-primary font-semibold">{b.clicked} clicked</span>. The next email for this tier learns from this.
              </p>
            )}
          </div>

          {/* The actual email as it sends */}
          <div className="rounded-xl border border-brand-line p-4 bg-white">
            <div className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/40 mb-2">The email · {isSent ? "sent" : "scheduled"} {when(b.sent_at)} to {b.recipients} people</div>
            <p className="text-sm text-brand-dark mb-3">Hi there,</p>
            {b.image && <img src={PIMG + b.image} alt="" className="w-full max-w-[280px] rounded-lg mb-3" />}
            {preview(b.body).map((p, i) => <p key={i} className="text-sm text-brand-dark/90 leading-relaxed mb-2">{p}</p>)}
            {b.cta_label && <p className="text-sm mt-1"><span className="text-brand-primary font-semibold">{b.cta_label} →</span></p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmailDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [openKey, setOpenKey] = useState<string>("");

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/diamond-crm-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${session?.access_token}` },
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Couldn't load."); return; }
      setData(d);
    } catch (e) { setErr(errorMessage(e, "Failed.")); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-brand-dark/50 text-sm">Loading email dashboard…</div>;
  if (err) return <div className="text-brand-primary text-sm">Couldn&apos;t load: {err}</div>;
  if (!data) return null;

  const now = data.now || new Date().toISOString();
  const ai = Array.isArray(data.ai) ? data.ai : [];
  const tiers = data.tiers || {};
  const pipeline = data.pipeline || {};
  const tierNames = data.tierNames || {};
  const automations = data.automations || [];
  const recent = data.recent || [];
  const learnings = data.learnings || [];
  const rc = data.recentCounts || {};
  const upcoming = ai.filter((b) => b.sent_at > now).sort((a, b) => a.sent_at.localeCompare(b.sent_at));
  const sent = ai.filter((b) => b.sent_at <= now);
  const keyOf = (b: Ai) => `${b.tier}-${b.sent_at}`;
  const toggle = (k: string) => setOpenKey((cur) => (cur === k ? "" : k));

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-brand-dark/50 max-w-xl">
          Triggered <strong>flows</strong> email each customer on their actions; the <strong>AI broadcaster</strong> writes and schedules one email per tier each day, logs its theory for why it should work, then learns from the real opens and clicks. Click any email to read it and its reasoning.
        </p>
        <button onClick={load} className="self-start border border-brand-primary text-brand-primary px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-brand-primary hover:text-brand-light transition-all">↺ Refresh</button>
      </div>

      <div>
        <h2 className="font-display text-2xl text-brand-dark mb-3">Audience tiers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {["1", "2", "3"].map((t) => <Stat key={t} label={tierNames[t] || `Tier ${t}`} value={(tiers[t] || 0).toLocaleString()} sub="people" />)}
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl text-brand-dark mb-3">Pipeline</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {STAGES.map((s) => <Stat key={s} label={STAGE_LABEL[s]} value={(pipeline[s] || 0).toLocaleString()} />)}
        </div>
      </div>

      {/* AI broadcast queue: what customers WILL receive — click to read the email + reasoning */}
      <div>
        <h2 className="font-display text-2xl text-brand-dark mb-1">Scheduled to send</h2>
        <p className="font-script text-lg text-brand-primary mb-3">one per tier per day · click to read</p>
        {upcoming.length === 0 ? (
          <p className="text-sm text-brand-dark/50">Nothing queued yet. The AI adds the next day each morning.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => <AiCard key={keyOf(b)} b={b} open={openKey === keyOf(b)} onToggle={() => toggle(keyOf(b))} />)}
          </div>
        )}
      </div>

      {/* AI broadcasts already sent: reasoning vs the real results */}
      <div>
        <h2 className="font-display text-2xl text-brand-dark mb-1">Already sent</h2>
        <p className="font-script text-lg text-brand-primary mb-3">the theory vs the real opens &amp; clicks</p>
        {sent.length === 0 ? (
          <p className="text-sm text-brand-dark/50">None sent yet.</p>
        ) : (
          <div className="space-y-2">
            {sent.map((b) => <AiCard key={keyOf(b)} b={b} open={openKey === keyOf(b)} onToggle={() => toggle(keyOf(b))} />)}
          </div>
        )}
      </div>

      {/* The compact playbook the AI keeps per tier — its distilled lessons, not the raw history */}
      <div>
        <h2 className="font-display text-2xl text-brand-dark mb-1">What the AI has learned</h2>
        <p className="font-script text-lg text-brand-primary mb-3">its playbook per tier, updated from real results</p>
        {learnings.length === 0 || learnings.every((l) => !l.playbook) ? (
          <p className="text-sm text-brand-dark/50">No lessons yet. The AI starts building a playbook once the first emails have been out long enough to measure opens and clicks.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {["tier1", "tier2", "tier3"].map((t) => {
              const l = learnings.find((x) => x.tier === t);
              return (
                <div key={t} className="border border-brand-line rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">{TIER_TAG[t] || t}</span>
                    {l && <span className="text-[10px] text-brand-dark/40">{l.emails_learned} learned</span>}
                  </div>
                  {l?.playbook ? (
                    <div className="text-[12px] text-brand-dark/80 leading-relaxed whitespace-pre-wrap">{l.playbook}</div>
                  ) : (
                    <p className="text-[12px] text-brand-dark/40">No lessons yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-2xl text-brand-dark mb-1">Automation flows</h2>
        <p className="font-script text-lg text-brand-primary mb-3">triggered per-person, always on</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {automations.map((a) => (
            <div key={a.name} className="border border-brand-line rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-brand-dark">{FLOW_LABEL[a.name] || a.name}</span>
              <span className={`text-[9px] font-bold uppercase tracking-widest ${a.status === "enabled" ? "text-green-600" : "text-brand-dark/40"}`}>{a.status === "enabled" ? "on" : a.status}</span>
            </div>
          ))}
          {automations.length === 0 && <p className="text-sm text-brand-dark/50">No flows found.</p>}
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl text-brand-dark mb-1">Recent activity</h2>
        <p className="font-script text-lg text-brand-primary mb-3">last 60 emails of every kind</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Stat label="Delivered" value={rc.delivered || 0} />
          <Stat label="Opened" value={rc.opened || 0} />
          <Stat label="Clicked" value={rc.clicked || 0} />
          <Stat label="Bounced / failed" value={(rc.bounced || 0) + (rc.failed || 0)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead><tr className="text-left text-[10px] uppercase tracking-widest text-brand-dark/40 border-b border-brand-line">
              <th className="py-2 pr-3">To</th><th className="py-2 px-2">Subject</th><th className="py-2 px-2">Status</th><th className="py-2 pl-2 text-right">When</th>
            </tr></thead>
            <tbody>
              {recent.slice(0, 30).map((e, i) => (
                <tr key={i} className="border-b border-brand-line/50">
                  <td className="py-2 pr-3 text-brand-dark/60 truncate max-w-[160px]">{e.to}</td>
                  <td className="py-2 px-2 text-brand-dark truncate max-w-[240px]">{e.subject}</td>
                  <td className={`py-2 px-2 font-semibold ${EVENT_COLOR[e.event] || "text-brand-dark/60"}`}>{e.event || "sent"}</td>
                  <td className="py-2 pl-2 text-right text-brand-dark/50 whitespace-nowrap">{when(e.at)}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={4} className="py-4 text-sm text-brand-dark/50">No sends yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
