// thepufflette.co — AI sequence drafter.
//
// Admin-only. Given an audience (a pipeline stage or behaviour tag), asks Claude to
// draft a short email sequence in the thepufflette.co voice and saves the steps to
// diamond_sequence_steps as INACTIVE drafts (active=false) for the owner to review
// and switch on. Never sends anything.
//
// Secrets: OPENROUTER_API_KEY (+ optional OPENROUTER_MODEL), plus auto-injected
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const MODEL = Deno.env.get("OPENROUTER_MODEL") || "anthropic/claude-3.5-sonnet";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const AUDIENCE_BRIEF: Record<string, string> = {
  lead: "Signed up but has never ordered. Goal: warmly introduce thepufflette.co and nudge them to place a first order.",
  new: "Just placed their FIRST order. Goal: thank them, set expectations, and encourage a second order + a review.",
  repeat: "Has ordered 2+ times. Goal: reward loyalty, surface favourites, and ask them to refer a friend.",
  vip: "A top customer (5+ orders or big spender). Goal: make them feel special with early access / perks and gratitude.",
  at_risk: "Hasn't ordered in 30+ days. Goal: a gentle 'we miss you' nudge to come back.",
  lapsed: "Hasn't ordered in 60+ days. Goal: a stronger win-back with a clear incentive to return.",
  all: "All customers. Goal: a friendly general re-engagement.",
  checkout: "Started checkout but didn't pay. Goal: recover the abandoned checkout quickly.",
  cart: "Added something to cart but didn't buy. Goal: remind them what's waiting and bring them back.",
  viewed: "Browsed a product but didn't add to cart. Goal: rekindle interest in what they viewed.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  if (!OPENROUTER_API_KEY) return json({ ok: false, error: "OPENROUTER_API_KEY is not set." }, 400);

  // Admin auth.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: ures } = token ? await admin.auth.getUser(token) : { data: { user: null } } as any;
  if (!ures?.user) return json({ ok: false, error: "Unauthorized" }, 401);
  const { data: isAdmin } = await admin.from("diamond_admins").select("id").eq("id", ures.user.id).maybeSingle();
  if (!isAdmin) return json({ ok: false, error: "Forbidden" }, 403);

  const { audience, count } = await req.json().catch(() => ({}));
  const brief = AUDIENCE_BRIEF[audience];
  if (!brief) return json({ ok: false, error: "Unknown audience" }, 400);
  const n = Math.min(Math.max(Number(count) || 3, 1), 6);

  const system =
    "You are an email copywriter for thepufflette.co (The Pufflette Co), a warm, gourmet puff puff & pancake shop in Abuja, Nigeria. " +
    "They sell milkcakes, cake tubs and cheesecakes, all ready-made and freshly baked, delivered across Abuja. " +
    "Prices are in Naira (₦); free delivery over ₦20,000. Voice: friendly, indulgent, a little playful, never pushy or salesy-spammy. " +
    "You write short, mobile-friendly emails. You may personalise with the literal tokens {first_name} and {product} " +
    "(the customer's last viewed/added item) where natural. Keep bodies to 2 short paragraphs.";

  const prompt =
    `Draft a ${n}-email sequence for this audience:\n${brief}\n\n` +
    `Return ONLY a JSON array (no prose) of ${n} objects, each:\n` +
    `{"delay_hours": <int HOURS after entering this stage; first is usually 0, then increasing — e.g. 0, 2, 48, 168>, ` +
    `"subject": <string, <=60 chars>, "heading": <string, the big line in the email>, ` +
    `"body": <string, 1-2 short paragraphs; use \\n\\n between paragraphs>, ` +
    `"button_label": <short CTA, e.g. "Order now">, "button_url": <one of "/shop", "/cart", "/">}.`;

  let steps: any[];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://yourdomain.com",
        "X-Title": "thepufflette.co",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        temperature: 0.8,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) { console.error("[DT GEN]", JSON.stringify(data)); return json({ ok: false, error: data?.error?.message || "AI request failed" }, 502); }
    const text = data?.choices?.[0]?.message?.content || "";
    const match = text.match(/\[[\s\S]*\]/);
    steps = JSON.parse(match ? match[0] : text);
    if (!Array.isArray(steps) || !steps.length) throw new Error("empty");
  } catch (e) {
    console.error("[DT GEN] parse/AI error:", e);
    return json({ ok: false, error: "Could not generate a valid sequence — try again." }, 502);
  }

  const rows = steps.slice(0, n).map((s, i) => ({
    audience,
    step_order: i + 1,
    delay_hours: Math.max(0, Math.round(Number(s.delay_hours) || 0)),
    subject: String(s.subject || "").slice(0, 200) || "thepufflette.co",
    heading: String(s.heading || "").slice(0, 200) || "Hello from thepufflette.co",
    body: String(s.body || ""),
    button_label: s.button_label ? String(s.button_label).slice(0, 40) : null,
    button_url: s.button_label ? (["/shop", "/cart", "/"].includes(s.button_url) ? s.button_url : "/shop") : null,
    active: false, // drafts — owner reviews + activates
  }));

  const { error } = await admin.from("diamond_sequence_steps").insert(rows);
  if (error) { console.error("[DT GEN] insert", error); return json({ ok: false, error: error.message }, 500); }
  return json({ ok: true, added: rows.length });
});
