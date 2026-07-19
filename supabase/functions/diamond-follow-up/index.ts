// Diamond Taste — Follow-up scheduler.
//
// Called every 15 min by pg_cron. Finds bot sessions idle for 45+ minutes that
// haven't been nudged for this idle period (last_followup_at is null), sends a
// contextual Instagram nudge as a button carousel, then stamps last_followup_at.
// The main bot resets last_followup_at back to null whenever the customer next
// interacts, so each new quiet period can earn one fresh nudge.
//
// Secrets: TEST_TOKEN, TEST_ID (same as the diamond-ig-bot), plus auto-injected
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("TEST_TOKEN")!;
const IG_ID = Deno.env.get("TEST_ID")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;

const IDLE_MINUTES = 45;
const FOLLOW_UP_STATES = ["awaiting_payment", "review", "shopping", "await_track_id"];

Deno.serve(async (req: Request) => {
  if (req.method === "GET") return new Response("Diamond Taste follow-up scheduler is ACTIVE.", { status: 200 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const cutoff = new Date(Date.now() - IDLE_MINUTES * 60 * 1000).toISOString();
  const { data: sessions, error } = await supabase
    .from("diamond_bot_sessions")
    .select("sender_id, state, cart, draft, saved_details")
    .in("state", FOLLOW_UP_STATES)
    .eq("handoff", false)
    .lt("last_activity_at", cutoff)
    .is("last_followup_at", null);

  if (error) {
    console.error("[DT FOLLOW-UP] DB query error:", error);
    return new Response(JSON.stringify({ error: "DB error" }), { status: 500 });
  }
  console.log(`[DT FOLLOW-UP] ${sessions?.length ?? 0} idle session(s) to follow up`);

  const results = await Promise.allSettled(
    (sessions || []).map(async (session: any) => {
      await sendFollowUp(session);
      await supabase.from("diamond_bot_sessions").update({ last_followup_at: new Date().toISOString() }).eq("sender_id", session.sender_id);
      await logMessage(session.sender_id, "out", "follow_up", `[follow-up sent for state: ${session.state}]`);
    }),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(`[DT FOLLOW-UP] Done — sent: ${sent}, failed: ${failed}`);
  return new Response(JSON.stringify({ sent, failed }), { status: 200, headers: { "Content-Type": "application/json" } });
});

async function sendFollowUp(session: any) {
  const { sender_id: sender, state, cart } = session;
  const cartTotal = Array.isArray(cart) ? cart.reduce((sum: number, l: any) => sum + Number(l.price) * Number(l.qty), 0) : 0;
  const cartNote = cartTotal > 0 ? ` — ${naira(cartTotal)} in your cart` : "";

  let text: string;
  let replies: { title: string; payload: string }[];

  switch (state) {
    case "awaiting_payment":
      text = `👋 Still there? Your payment link is just above in this chat${cartNote}. Tap it to finish your order, or start again below.`;
      replies = [{ title: "🏠 Start Over", payload: "MENU" }, { title: "✏️ Change Cart", payload: "EDIT_CART" }, { title: "💬 Talk to Staff", payload: "SUPPORT" }];
      break;
    case "review":
      text = `👋 Your order is ready${cartNote}. Tap 💳 Pay Now to place it, or use the buttons below.`;
      replies = [{ title: "💳 Pay Now", payload: "PAY" }, { title: "⬅️ Change Delivery", payload: "CHECKOUT" }, { title: "🏠 Home", payload: "MENU" }];
      break;
    case "shopping":
      text = `👋 Still picking your cakes?${cartNote ? ` You've got${cartNote}.` : ""} Carry on where you left off.`;
      replies = [{ title: "🛍️ See Our Cakes", payload: "SHOP" }, { title: "🛒 View My Cart", payload: "CART" }, { title: "🏠 Home", payload: "MENU" }];
      break;
    case "await_track_id":
      text = `👋 Still want to track your order? Send your order ID (like DT-A2K9P) and I'll check it for you.`;
      replies = [{ title: "🏠 Home", payload: "MENU" }];
      break;
    default:
      return;
  }

  await sendText(sender, text);
  await sendOptions(sender, "Pick an option 👇", replies);
  console.log(`[DT FOLLOW-UP] Sent ${state} nudge → ${sender}`);
}

// ── Instagram Send API (carousel buttons, never quick-reply chips) ──
function sendText(sender: string, text: string) {
  return sendIG(sender, { text });
}
const btn = (title: string, payload: string) => ({ type: "postback", title: title.slice(0, 20), payload });
function sendOptions(sender: string, text: string, replies: { title: string; payload: string }[]) {
  const cards: any[] = [];
  for (let i = 0; i < replies.length; i += 3) {
    cards.push({ title: (i === 0 ? text : "More options").slice(0, 80), buttons: replies.slice(i, i + 3).map((r) => btn(r.title, r.payload)) });
  }
  return sendIG(sender, { attachment: { type: "template", payload: { template_type: "generic", elements: cards.slice(0, 10) } } });
}

async function sendIG(recipientId: string, message: any) {
  const res = await fetch(`https://graph.instagram.com/v25.0/${IG_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`[DT FOLLOW-UP] IG DM failed for ${recipientId}:`, JSON.stringify(err));
    throw new Error(`IG API ${res.status}`);
  }
}

async function logMessage(sender: string, direction: "in" | "out", type: string, content: string) {
  try { await supabase.from("diamond_bot_messages").insert({ sender_id: sender, direction, type, content }); }
  catch (e) { console.error("[DT FOLLOW-UP] logMessage error:", e); }
}
