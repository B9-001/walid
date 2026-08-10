"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { tagInfo } from "@/lib/segments";

type Overview = {
  total_sent: number; sequence_sent: number; delivered: number; opened: number;
  clicked: number; bounced: number; orders: number; revenue: number; unsubscribes: number;
};
type SeqRow = {
  step_id: string; audience: string; step_order: number; subject: string; active: boolean;
  heading: string | null; body: string | null; image_url: string | null; button_label: string | null; button_url: string | null;
  sent: number; delivered: number; opened: number; clicked: number; orders: number; revenue: number;
};
type BroadcastRow = { subject: string; sent: number; opened: number; clicked: number; last_sent: string | null };
type Stats = { overview: Overview; sequences: SeqRow[]; broadcasts: BroadcastRow[] };
type Recipient = { email: string; name: string; opened: boolean; clicked: boolean; ordered?: boolean; sent_at: string };

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const AUD_ORDER = ["lead", "new", "repeat", "vip", "at_risk", "lapsed", "checkout", "cart", "viewed", "all"];
const shortDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "·";
const sampleFill = (s: string | null) => (s || "").replace(/\{first_name\}/gi, "there").replace(/\{product\}/gi, "your order");

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-brand-line rounded-2xl p-4">
      <div className="text-[10px] font-bold tracking-widest uppercase text-brand-dark/50">{label}</div>
      <div className="text-2xl font-display text-brand-dark mt-1 leading-none">{value}</div>
      {sub && <div className="text-[11px] text-brand-dark/50 mt-1">{sub}</div>}
    </div>
  );
}

function EmailPreview({ row, onClose }: { row: SeqRow; onClose: () => void }) {
  const paras = (row.body || "").split(/\n{1,}/).map((p) => p.trim()).filter((p) => p && p !== "{image}");
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-xl w-full my-8 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-brand-line flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-widest text-brand-dark/50">Email preview</div>
          <button onClick={onClose} className="text-brand-dark/50 hover:text-brand-primary text-lg leading-none">✕</button>
        </div>
        <div className="px-5 py-3 border-b border-brand-line">
          <div className="text-[10px] uppercase tracking-widest text-brand-dark/40">Subject</div>
          <div className="text-brand-dark font-semibold">{sampleFill(row.subject)}</div>
        </div>
        <div className="p-6 text-[15px] leading-relaxed text-[#222]" style={{ fontFamily: "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif" }}>
          <p className="mb-4">Hi there,</p>
          {row.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.image_url} alt="" className="w-full rounded-lg mb-4" />
          )}
          {paras.map((p, i) => <p key={i} className="mb-4">{sampleFill(p)}</p>)}
          {row.button_label && row.button_url && (
            <p className="mb-4"><span className="text-brand-primary underline">{sampleFill(row.button_label)} →</span></p>
          )}
          <p className="mt-6 text-[12px] text-gray-400">If you&apos;d rather not hear from us, you can unsubscribe here.</p>
        </div>
      </div>
    </div>
  );
}

function RecipientsModal({ title, rows, onClose }: { title: string; rows: Recipient[] | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full my-8" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-brand-line flex items-center justify-between">
          <div className="text-sm font-semibold text-brand-dark">{title}</div>
          <button onClick={onClose} className="text-brand-dark/50 hover:text-brand-primary text-lg leading-none">✕</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {rows === null ? (
            <div className="p-5 text-sm text-brand-dark/50">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-5 text-sm text-brand-dark/50">No one yet.</div>
          ) : (
            rows.map((r, i) => (
              <div key={i} className="px-5 py-2.5 border-b border-brand-line/50 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  {r.name && <div className="text-sm text-brand-dark truncate">{r.name}</div>}
                  <div className="text-[12px] text-brand-dark/50 truncate">{r.email}</div>
                </div>
                {r.ordered && <span className="text-[9px] font-bold uppercase tracking-widest text-green-600 shrink-0">ordered</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmailStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<SeqRow | null>(null);
  const [recip, setRecip] = useState<{ title: string; rows: Recipient[] | null } | null>(null);

  const load = async () => {
    setLoading(true);
    setErr("");
    const { data, error } = await supabase.rpc("diamond_email_stats");
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setStats(data as Stats);
  };
  useEffect(() => { load(); }, []);

  const openRecipients = async (opts: { stepId?: string; subject?: string; kind: "opened" | "clicked"; label: string }) => {
    setRecip({ title: opts.label, rows: null });
    const { data } = opts.stepId
      ? await supabase.rpc("diamond_step_recipients", { p_step_id: opts.stepId })
      : await supabase.rpc("diamond_broadcast_recipients", { p_subject: opts.subject });
    const all = (data as Recipient[]) || [];
    setRecip({ title: opts.label, rows: all.filter((r) => (opts.kind === "opened" ? r.opened : r.clicked)) });
  };

  if (loading) return <div className="text-brand-dark/50 text-sm">Loading stats…</div>;
  if (err) return <div className="text-brand-primary text-sm">Couldn&apos;t load stats: {err}</div>;
  if (!stats) return null;

  const o = stats.overview;
  const byAud: Record<string, SeqRow[]> = {};
  for (const r of stats.sequences) (byAud[r.audience] ||= []).push(r);
  const auds = Object.keys(byAud).sort((a, b) => AUD_ORDER.indexOf(a) - AUD_ORDER.indexOf(b));

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-[12px] text-brand-dark/50 max-w-xl">
          Tap an email to preview it. Tap an <span className="text-brand-dark/70">opened</span> or
          <span className="text-brand-dark/70"> clicked</span> number to see who. Opens are approximate (privacy features
          inflate them) — trust clicks and orders most.
        </p>
        <button onClick={load} className="self-start border border-brand-primary text-brand-primary px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-brand-primary hover:text-brand-light transition-all">↺ Refresh</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Emails sent" value={o.total_sent.toLocaleString()} sub={`${o.sequence_sent.toLocaleString()} from sequences`} />
        <Stat label="Delivered" value={o.delivered.toLocaleString()} />
        <Stat label="Opened" value={o.opened.toLocaleString()} sub={`${pct(o.opened, o.delivered || o.total_sent)}% of delivered`} />
        <Stat label="Clicked" value={o.clicked.toLocaleString()} sub={`${pct(o.clicked, o.opened)}% of opens`} />
        <Stat label="Orders from email" value={o.orders.toLocaleString()} />
        <Stat label="Revenue from email" value={formatNaira(o.revenue)} />
        <Stat label="Unsubscribed" value={o.unsubscribes.toLocaleString()} />
        <Stat label="Bounced" value={o.bounced.toLocaleString()} />
      </div>

      <div>
        <h2 className="font-display text-2xl text-brand-dark mb-1">Sequences</h2>
        <p className="font-script text-lg text-brand-primary mb-4">tap any email to preview it</p>
        <div className="space-y-6">
          {auds.map((aud) => (
            <div key={aud}>
              <div className="text-[11px] font-bold tracking-widest uppercase text-brand-primary mb-2">{tagInfo(aud)?.label || aud}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-widest text-brand-dark/40 border-b border-brand-line">
                      <th className="py-2 pr-3">Email</th><th className="py-2 px-2">Sent</th><th className="py-2 px-2">Opened</th><th className="py-2 px-2">Clicked</th><th className="py-2 px-2">Orders</th><th className="py-2 pl-2 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byAud[aud].map((r) => (
                      <tr key={r.step_id} className="border-b border-brand-line/50">
                        <td className="py-2 pr-3">
                          <button onClick={() => setPreview(r)} className="text-left text-brand-dark hover:text-brand-primary hover:underline">
                            <span className="text-brand-dark/40">{r.step_order}.</span> {r.subject}
                            {!r.active && <span className="text-brand-dark/40"> (off)</span>}
                          </button>
                        </td>
                        <td className="py-2 px-2">{r.sent}</td>
                        <td className="py-2 px-2">
                          <button disabled={!r.opened} onClick={() => openRecipients({ stepId: r.step_id, kind: "opened", label: `Opened · ${r.subject}` })} className={r.opened ? "text-brand-dark hover:text-brand-primary hover:underline" : "text-brand-dark/40 cursor-default"}>
                            {r.opened} <span className="text-brand-dark/40">({pct(r.opened, r.sent)}%)</span>
                          </button>
                        </td>
                        <td className="py-2 px-2">
                          <button disabled={!r.clicked} onClick={() => openRecipients({ stepId: r.step_id, kind: "clicked", label: `Clicked · ${r.subject}` })} className={r.clicked ? "text-brand-dark hover:text-brand-primary hover:underline" : "text-brand-dark/40 cursor-default"}>
                            {r.clicked} <span className="text-brand-dark/40">({pct(r.clicked, r.opened)}%)</span>
                          </button>
                        </td>
                        <td className="py-2 px-2 font-semibold text-brand-dark">{r.orders}</td>
                        <td className="py-2 pl-2 text-right">{formatNaira(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {auds.length === 0 && <p className="text-sm text-brand-dark/50">No sequence emails sent yet.</p>}
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl text-brand-dark mb-1">Campaigns</h2>
        <p className="font-script text-lg text-brand-primary mb-4">one-off marketing broadcasts</p>
        {stats.broadcasts.length === 0 ? (
          <p className="text-sm text-brand-dark/50">No broadcasts yet. Marketing emails you send from the Marketing tab will show up here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-brand-dark/40 border-b border-brand-line">
                  <th className="py-2 pr-3">Campaign</th><th className="py-2 px-2">Sent on</th><th className="py-2 px-2">Sent</th><th className="py-2 px-2">Opened</th><th className="py-2 pl-2">Clicked</th>
                </tr>
              </thead>
              <tbody>
                {stats.broadcasts.map((b, i) => (
                  <tr key={i} className="border-b border-brand-line/50">
                    <td className="py-2 pr-3 text-brand-dark">{b.subject}</td>
                    <td className="py-2 px-2 text-brand-dark/60 whitespace-nowrap">{shortDate(b.last_sent)}</td>
                    <td className="py-2 px-2">{b.sent}</td>
                    <td className="py-2 px-2">
                      <button disabled={!b.opened} onClick={() => openRecipients({ subject: b.subject, kind: "opened", label: `Opened · ${b.subject}` })} className={b.opened ? "text-brand-dark hover:text-brand-primary hover:underline" : "text-brand-dark/40 cursor-default"}>
                        {b.opened} <span className="text-brand-dark/40">({pct(b.opened, b.sent)}%)</span>
                      </button>
                    </td>
                    <td className="py-2 pl-2">
                      <button disabled={!b.clicked} onClick={() => openRecipients({ subject: b.subject, kind: "clicked", label: `Clicked · ${b.subject}` })} className={b.clicked ? "text-brand-dark hover:text-brand-primary hover:underline" : "text-brand-dark/40 cursor-default"}>
                        {b.clicked} <span className="text-brand-dark/40">({pct(b.clicked, b.sent)}%)</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {preview && <EmailPreview row={preview} onClose={() => setPreview(null)} />}
      {recip && <RecipientsModal title={recip.title} rows={recip.rows} onClose={() => setRecip(null)} />}
    </div>
  );
}