// Diamond Taste — AI single-email composer / editor.
//
// Admin-only. Two modes, both returning ONE email object (never writes to the DB —
// the admin reviews it in the editor and saves):
//
//   mode "create": { instruction, audience } -> drafts a brand-new email from a
//                  plain-English description, for the given pipeline/behaviour tag.
//   mode "edit":   { instruction, current } -> revises an existing email per the
//                  instruction ("make it shorter", "warmer", "mention free delivery"…).
//
// Voice + tokens match the sequence drafter. The body may contain the literal
// tokens {first_name}, {product} and {image} (an inline image placeholder).
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
  lead: "Signed up but has never ordered. Goal: warmly introduce Diamond Taste and nudge a first order.",
  new: "Just placed their FIRST order. Goal: thank them, set expectations, encourage a second order + a review.",
  repeat: "Has ordered 2+ times. Goal: reward loyalty, surface favourites, ask them to refer a friend.",
  vip: "A top customer (5+ orders or big spender). Goal: make them feel special with perks and gratitude.",
  at_risk: "Hasn't ordered in 30+ days. Goal: a gentle 'we miss you' nudge to come back.",
  lapsed: "Hasn't ordered in 60+ days. Goal: a stronger win-back with a clear incentive.",
  all: "All customers. Goal: a friendly general re-engagement.",
  checkout: "Started checkout but didn't pay. Goal: recover the abandoned checkout quickly.",
  cart: "Added something to cart but didn't buy. Goal: remind them what's waiting and bring them back.",
  viewed: "Browsed a product but didn't add to cart. Goal: rekindle interest in what they viewed.",
};

const SYSTEM =
  "You are an email copywriter for Diamond Taste, a warm, premium home-bakery in Abuja, Nigeria. " +
  "They sell milkcakes, cake tubs and cheesecakes, all ready-made and freshly baked, delivered across Abuja. " +
  "Prices are in Naira (₦); free delivery over ₦20,000. Voice: friendly, indulgent, a little playful, never pushy or spammy. " +
  "You write short, mobile-friendly emails. You may personalise with the literal tokens {first_name} and {product} " +
  "(the customer's last viewed/added item) where natural, and place an image with the literal token {image} on its own line. " +
  "Keep bodies to 1-2 short paragraphs.";

const SHAPE =
  `Return ONLY a JSON object (no prose, no markdown fences):\n` +
  `{"subject": <string, <=60 chars>, "heading": <string, the big line in the email>, ` +
  `"body": <string, 1-2 short paragraphs; use \\n\\n between paragraphs; optionally a line that is exactly {image}>, ` +
  `"button_label": <short CTA or "">, "button_url": <one of "/shop", "/cart", "/" or "">}.`;

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

  const { mode, instruction, audience, current } = await req.json().catch(() => ({}));
  if (!instruction || !String(instruction).trim()) return json({ ok: false, error: "Tell the AI what you want." }, 400);

  let prompt: string;
  if (mode === "edit") {
    const c = current || {};
    prompt =
      `Revise this Diamond Taste email per the instruction. Keep what works; only change what's asked. ` +
      `Preserve any {first_name}, {product} or {image} tokens unless the instruction says to change them.\n\n` +
      `INSTRUCTION: ${String(instruction).trim()}\n\n` +
      `CURRENT EMAIL:\n` +
      `subject: ${c.subject || ""}\nheading: ${c.heading || ""}\nbody:\n${c.body || ""}\n` +
      `button_label: ${c.button_label || ""}\nbutton_url: ${c.button_url || ""}\n\n` +
      SHAPE;
  } else {
    const brief = audience && AUDIENCE_BRIEF[audience] ? `\nAudience: ${AUDIENCE_BRIEF[audience]}` : "";
    prompt =
      `Write ONE Diamond Taste email from this description.${brief}\n\n` +
      `DESCRIPTION: ${String(instruction).trim()}\n\n` +
      SHAPE;
  }

  let email: any;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://yourdomain.com",
        "X-Title": "Diamond Taste",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        temperature: 0.75,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) { console.error("[DT COMPOSE]", JSON.stringify(data)); return json({ ok: false, error: data?.error?.message || "AI request failed" }, 502); }
    const text = data?.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    email = JSON.parse(match ? match[0] : text);
  } catch (e) {
    console.error("[DT COMPOSE] parse/AI error:", e);
    return json({ ok: false, error: "Could not draft a valid email — try again." }, 502);
  }

  const clean = {
    subject: String(email.subject || "").slice(0, 200),
    heading: String(email.heading || "").slice(0, 200),
    body: String(email.body || ""),
    button_label: email.button_label ? String(email.button_label).slice(0, 40) : "",
    button_url: email.button_label ? (["/shop", "/cart", "/"].includes(email.button_url) ? email.button_url : "/shop") : "",
  };
  if (!clean.subject && !clean.heading && !clean.body) return json({ ok: false, error: "Empty draft — try again." }, 502);
  return json({ ok: true, email: clean });
});
