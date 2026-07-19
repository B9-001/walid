"use client";

import { useEffect, useState, useCallback } from "react";
import { errorMessage } from "@/lib/format";

type Summary = {
  range_days: number;
  visitors: number;
  page_views: number;
  clicks: number;
  product_views: number;
  add_to_carts: number;
  sessions_with_atc: number;
  top_pages: { path: string; views: number }[];
  top_clicks: { label: string; clicks: number }[];
  exits: { path: string; exits: number; avg_seconds: number }[];
  by_day: { day: string; visitors: number; views: number }[];
  orders: number;
  revenue: number;
};

const PW_KEY = "dt_control_key";
const naira = (n: number) => "₦" + (n || 0).toLocaleString();

export default function ControlCenter() {
  const [key, setKey] = useState("");
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(PW_KEY);
    if (saved) { setKey(saved); setAuthed(true); }
  }, []);

  const load = useCallback(async (k: string, d: number) => {
    setLoading(true); setErr("");
    try {
      const res = await fetch(`/api/analytics?key=${encodeURIComponent(k)}&days=${d}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setData(json.data);
      localStorage.setItem(PW_KEY, k);
      setAuthed(true);
    } catch (e) {
      const msg = errorMessage(e);
      setErr(msg === "unauthorized" ? "Wrong password" : msg);
      setAuthed(false);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authed && key) load(key, days); }, [days]); // eslint-disable-line

  const convRate = data && data.visitors ? ((data.orders / data.visitors) * 100).toFixed(1) : "0";
  const atcRate = data && data.visitors ? ((data.sessions_with_atc / data.visitors) * 100).toFixed(1) : "0";

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1014", fontFamily: "system-ui" }}>
        <div style={{ background: "#fff", padding: 32, borderRadius: 16, width: 340 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: "#6E1A2E" }}>Diamond Taste — Control Centre</h1>
          <p style={{ fontSize: 13, color: "#777", marginBottom: 16 }}>Enter the access password.</p>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Password"
            onKeyDown={(e) => e.key === "Enter" && load(key, days)}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #ddd", marginBottom: 12 }} />
          {err && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{err}</p>}
          <button onClick={() => load(key, days)} disabled={loading}
            style={{ width: "100%", padding: 12, borderRadius: 10, border: 0, background: "#E0218A", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            {loading ? "Checking…" : "Enter"}
          </button>
        </div>
      </div>
    );
  }

  const cards = data ? [
    { label: "Visitors", value: data.visitors.toLocaleString() },
    { label: "Page views", value: data.page_views.toLocaleString() },
    { label: "Product views", value: data.product_views.toLocaleString() },
    { label: "Add to carts", value: data.add_to_carts.toLocaleString() },
    { label: "Orders", value: data.orders.toLocaleString() },
    { label: "Revenue", value: naira(data.revenue) },
    { label: "Conversion rate", value: convRate + "%" },
    { label: "Add-to-cart rate", value: atcRate + "%" },
  ] : [];

  return (
    <div style={{ minHeight: "100vh", background: "#faf6f2", fontFamily: "system-ui", padding: "28px 24px", color: "#2a2230" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#6E1A2E" }}>Control Centre</h1>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            style={{ padding: "8px 14px", borderRadius: 30, border: "1px solid #ddd", background: "#fff" }}>
            <option value={1}>Today</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {loading && <p>Loading…</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 14, marginBottom: 26 }}>
          {cards.map((c) => (
            <div key={c.label} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", boxShadow: "0 4px 14px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 12, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#6E1A2E", marginTop: 4 }}>{c.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 18 }}>
          <Panel title="Top pages (most viewed)">
            <Table rows={(data?.top_pages || []).map((r) => [r.path || "/", r.views])} head={["Page", "Views"]} />
          </Panel>
          <Panel title="Most clicked">
            <Table rows={(data?.top_clicks || []).map((r) => [r.label, r.clicks])} head={["Element", "Clicks"]} />
          </Panel>
          <Panel title="Where people exit (avg time on page)">
            <Table rows={(data?.exits || []).map((r) => [r.path || "/", `${r.exits} exits · ${r.avg_seconds}s`])} head={["Page", "Exits"]} />
          </Panel>
          <Panel title="Daily traffic">
            <Table rows={(data?.by_day || []).map((r) => [r.day, `${r.visitors} visitors · ${r.views} views`])} head={["Day", "Activity"]} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 4px 14px rgba(0,0,0,0.05)" }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#6E1A2E" }}>{title}</h2>
      {children}
    </div>
  );
}

function Table({ rows, head }: { rows: (string | number)[][]; head: [string, string] }) {
  if (!rows.length) return <p style={{ color: "#aaa", fontSize: 13 }}>No data yet.</p>;
  return (
    <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ color: "#999", textAlign: "left" }}>
          <th style={{ paddingBottom: 8 }}>{head[0]}</th>
          <th style={{ paddingBottom: 8, textAlign: "right" }}>{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderTop: "1px solid #f0e8e2" }}>
            <td style={{ padding: "8px 0", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r[0]}</td>
            <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>{r[1]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
