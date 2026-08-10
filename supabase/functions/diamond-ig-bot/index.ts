// "Diamond Taste" — Instagram ordering chatbot (Supabase Edge Function, Deno).
//
// Deploy:  supabase functions deploy diamond-ig-bot --no-verify-jwt
// Webhook: set the Meta Instagram webhook callback URL to this function's URL,
//          verify token = META_VERIFY_TOKEN below.
//
// Secrets (supabase secrets set ...):
//   TEST_TOKEN                — Instagram page access token   (start with the TEST token)
//   TEST_ID                   — Instagram business account id (start with the TEST id)
//   DT_PAYSTACK_SECRET        — Paystack secret key (sk_test_... to start)
//   DT_PAYSTACK_SUBACCOUNT    — (optional) Paystack subaccount code for the split
//   DT_RESEND_API_KEY         — (optional) for "speak to human" email alerts (falls back to RESEND_API_KEY)
//   SHOP_SUPPORT_EMAIL        — where handoff alerts go
//   SHOP_FROM_EMAIL           — a Resend-verified from address
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TEST_TOKEN = Deno.env.get("TEST_TOKEN")!;       // Instagram access token
const TEST_ID = Deno.env.get("TEST_ID")!;             // Instagram business id
const META_VERIFY_TOKEN = "diamondtaste2026";
const PAYSTACK_SECRET = Deno.env.get("DT_PAYSTACK_SECRET")!;
const PAYSTACK_SUBACCOUNT = Deno.env.get("DT_PAYSTACK_SUBACCOUNT") || "";
const RESEND_API_KEY = Deno.env.get("DT_RESEND_API_KEY") || Deno.env.get("RESEND_API_KEY") || "";
const SHOP_SUPPORT_EMAIL = Deno.env.get("SHOP_SUPPORT_EMAIL") || "admin@example.com";
const SHOP_FROM_EMAIL = Deno.env.get("SHOP_FROM_EMAIL") || "onboarding@resend.dev";

const WEBSITE = "https://yourdomain.com";
// Birthday cakes are handled on WhatsApp, not in-chat. wa.me opens a chat to this number.
const WHATSAPP_NUMBER = "2348033229772";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi Diamond Taste! I'd like to order a birthday cake 🎂")}`;
const FREE_DELIVERY_MIN = 2_000_000; // ₦20,000 in kobo — free delivery for everyone
const SERVICE_FEE_MIN_DELIVERY = 500_000; // ₦5,000 — above this a service fee applies
const SERVICE_FEE_BASE = 450_000;         // ₦4,500
const PICKUP_FALLBACK = "Diamond Taste, Abuja";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const GREETINGS = ["hi", "hii", "hello", "helo", "hey", "heyy", "start", "menu", "shop", "yo", "sup", "diamond", "diamondtaste"];

// Money is stored in KOBO (₦ × 100) across the Diamond Taste DB.
const naira = (kobo: number) => `₦${Math.round((kobo || 0) / 100).toLocaleString("en-NG")}`;

// ───────────────────────────── data access ─────────────────────────────
type Product = { id: string; name: string; price: number; image: string | null; category: string; stock: number | null };
type Category = { name: string; image: string | null; count: number };

function normalizeProduct(row: any): Product {
  return { id: row.id, name: row.name, price: Number(row.base_price) || 0, image: row.image_url, category: row.category, stock: row.stock_level ?? null };
}
const inStock = (p: Product) => p.stock === null || p.stock > 0;

async function getCategoryCards(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("diamond_products")
    .select("category, image_url, stock_level, featured")
    .eq("active", true)
    .order("featured", { ascending: false });
  if (error) { console.error("[DT] getCategoryCards", error); return []; }
  const cats = await supabase.from("diamond_categories").select("name, image_url, sort_order").order("sort_order", { ascending: true });
  const order = new Map<string, number>((cats.data || []).map((c: any, i: number) => [c.name, c.sort_order ?? i]));
  const catImg = new Map<string, string | null>((cats.data || []).map((c: any) => [c.name, c.image_url]));
  const map = new Map<string, Category>();
  for (const row of (data || []) as any[]) {
    const cat = row.category;
    if (!cat) continue;
    if (!(row.stock_level === null || row.stock_level > 0)) continue;
    const ex = map.get(cat);
    if (!ex) map.set(cat, { name: cat, image: row.image_url || catImg.get(cat) || null, count: 1 });
    else { ex.count++; if (!ex.image && row.image_url) ex.image = row.image_url; }
  }
  return [...map.values()].sort((a, b) => (order.get(a.name) ?? 99) - (order.get(b.name) ?? 99));
}

async function getProductsByCategory(cat: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from("diamond_products")
    .select("id, name, base_price, image_url, category, stock_level")
    .eq("active", true).eq("category", cat)
    .order("featured", { ascending: false }).order("base_price", { ascending: true }).limit(10);
  if (error) { console.error("[DT] getProductsByCategory", error); return []; }
  return (data || []).map(normalizeProduct);
}

async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase.from("diamond_products").select("id, name, base_price, image_url, category, stock_level").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return normalizeProduct(data);
}

type DeliveryArea = { id: string; location: string; fee: number };
async function getAreas(): Promise<DeliveryArea[]> {
  const { data } = await supabase.from("diamond_delivery_fees").select("id, location, fee").eq("is_active", true).order("sort_order", { ascending: true });
  return (data || []).map((a: any) => ({ id: a.id, location: a.location, fee: Number(a.fee) || 0 }));
}
async function getArea(id: string): Promise<DeliveryArea | null> {
  const { data } = await supabase.from("diamond_delivery_fees").select("id, location, fee").eq("id", id).maybeSingle();
  return data ? { id: data.id, location: data.location, fee: Number(data.fee) || 0 } : null;
}
async function getPickupAddress(): Promise<string> {
  const { data } = await supabase.from("diamond_site_settings").select("pickup_address").limit(1).maybeSingle();
  return data?.pickup_address || PICKUP_FALLBACK;
}

// ───────────────────────────── delivery maths ─────────────────────────────
// Free delivery over ₦20k; for far areas (fee ≥ ₦5,000) a service fee = fee − ₦4,500 applies.
function deliveryBreakdown(subtotal: number, areaFee: number): { deliveryFee: number; serviceFee: number; free: boolean } {
  const free = subtotal >= FREE_DELIVERY_MIN;
  if (free) return { deliveryFee: 0, serviceFee: areaFee >= SERVICE_FEE_MIN_DELIVERY ? areaFee - SERVICE_FEE_BASE : 0, free: true };
  return { deliveryFee: areaFee, serviceFee: 0, free: false };
}

// ───────────────────────────── session ─────────────────────────────
type CartLine = { product_id: string; name: string; qty: number; price: number };
type Draft = { method?: "delivery" | "pickup"; area_id?: string; area_name?: string; area_fee?: number; complaint_order?: string | null; last_prod_id?: string };
type SavedDetails = { name?: string; phone?: string; email?: string; address?: string };
type Session = { sender_id: string; state: string; cart: CartLine[]; draft: Draft; handoff: boolean; handoff_at?: string | null; last_prompt?: string | null; saved_details?: SavedDetails | null };

async function loadSession(sender: string): Promise<Session> {
  const { data } = await supabase.from("diamond_bot_sessions").select("*").eq("sender_id", sender).maybeSingle();
  if (data) return { sender_id: sender, state: data.state, cart: data.cart ?? [], draft: data.draft ?? {}, handoff: !!data.handoff, handoff_at: data.handoff_at ?? null, last_prompt: data.last_prompt, saved_details: data.saved_details ?? null };
  return { sender_id: sender, state: "menu", cart: [], draft: {}, handoff: false, handoff_at: null, saved_details: null };
}
async function saveSession(s: Session) {
  const { error } = await supabase.from("diamond_bot_sessions").upsert({
    sender_id: s.sender_id, state: s.state, cart: s.cart, draft: s.draft, handoff: s.handoff,
    handoff_at: s.handoff_at ?? null, last_prompt: s.last_prompt ?? null, saved_details: s.saved_details ?? null,
    last_activity_at: new Date().toISOString(),
    last_followup_at: null, // reset so the idle follow-up can fire again next time they go quiet
  }, { onConflict: "sender_id" });
  if (error) console.error("[DT] saveSession", error);
}
const cartTotal = (s: Session) => s.cart.reduce((sum, l) => sum + l.price * l.qty, 0);

async function logMessage(sender: string, direction: "in" | "out", type: string, content: string, raw: unknown = null) {
  try { await supabase.from("diamond_bot_messages").insert({ sender_id: sender, direction, type, content: content?.slice(0, 2000) ?? null, raw }); }
  catch (e) { console.error("[DT] logMessage", e); }
}

// ───────────────────────────── webhook entry ─────────────────────────────
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode"), token = url.searchParams.get("hub.verify_token"), challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === META_VERIFY_TOKEN) return new Response(challenge, { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  let payload: any;
  try { payload = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (payload?.object !== "instagram") return new Response("EVENT_RECEIVED", { status: 200 });
  try {
    for (const entry of payload.entry || []) {
      for (const event of entry.messaging || []) {
        const sender = event.sender?.id;
        if (!sender || event.message?.is_echo) continue;
        await sendSenderAction(sender, "typing_on");
        const tapped = event.postback?.payload || event.message?.quick_reply?.payload;
        if (tapped) { await logMessage(sender, "in", "postback", tapped, event); await handleAction(sender, tapped); continue; }
        if (event.message?.text) { await logMessage(sender, "in", "text", event.message.text, event); await handleText(sender, event.message.text.trim()); continue; }
        if (event.message) { await logMessage(sender, "in", "other", "media", event); await handleAnyMessage(sender); }
      }
    }
  } catch (err) { console.error("[DT] Error:", err); }
  return new Response("EVENT_RECEIVED", { status: 200 });
});

// ───────────────────────────── routing ─────────────────────────────
async function handleAction(sender: string, payload: string) {
  const s = await loadSession(sender);
  const [action, ...rest] = payload.split("::");
  if (s.handoff && action !== "HANDOFF_CONFIRM") { s.handoff = false; s.handoff_at = null; }
  try {
    switch (action) {
      case "MENU": s.state = "menu"; await sendWelcome(s); break;
      case "SHOP": await sendShopChoice(sender); break;
      case "BIRTHDAY": await sendBirthdayWhatsApp(sender); break;
      case "SHOP_HERE": s.state = "shopping"; await sendCategories(sender); break;
      case "ORDERS": case "TRACK_MENU": await sendOrdersCarousel(sender); break;
      case "TRACK": s.state = "await_track_id"; await sendOptions(sender, "Enter your order ID (looks like DT-XXXXXX) and I'll check it for you 👇", [{ title: "🏠 Home", payload: "MENU" }]); break;
      case "SUPPORT": await sendSupportDisclaimer(sender); break;
      case "HANDOFF_CONFIRM": case "HUMAN": await confirmHandoff(s); break;
      case "CAT": await sendProducts(sender, rest.join("::")); break;
      case "PROD": s.draft.last_prod_id = rest[0]; s.state = "await_quantity"; await sendQuantities(sender, rest[0]); break;
      case "QTY": await addToCart(s, rest[0], Number(rest[1] || 1)); break;
      case "CART": await sendCart(s); break;
      case "EDIT_CART": await sendEditCart(s); break;
      case "REMOVE": await removeFromCart(s, Number(rest[0])); break;
      case "REDUCE": await reduceQuantity(s, Number(rest[0])); break;
      case "CHECKOUT": await askFulfilment(s); break;
      case "FULFIL": await chooseFulfilment(s, rest[0]); break;
      case "AREA": await chooseArea(s, rest[0]); break;
      case "AREA_PAGE": await sendAreasPage(s.sender_id, Number(rest[0]) || 0); break;
      case "PAY": await askOrPay(s); break;
      case "PAY_SAVED": await sendPaymentLink(s, true); break;
      case "PAY_NEW": await sendPaymentLink(s, false); break;
      default: await sendWelcome(s);
    }
  } finally { await saveSession(s); }
}

async function handleText(sender: string, text: string) {
  const s = await loadSession(sender);
  const lower = text.toLowerCase();
  try {
    if (s.handoff) return;
    const AVAIL = ["available", "availability", "in stock", "do you have", "what do you have", "what items", "show me", "see products", "do you sell", "what do you sell", "price", "how much"];
    const BIRTHDAY = ["birthday", "bday", "b-day", "b day"];
    const notSpecific = !["await_track_id", "await_quantity", "await_complaint_order", "await_complaint_text"].includes(s.state);
    if (notSpecific && BIRTHDAY.some((k) => lower.includes(k))) { await sendBirthdayWhatsApp(sender); return; }
    if (notSpecific && AVAIL.some((k) => lower.includes(k))) { s.state = "shopping"; await sendText(sender, "Here's what we have on the menu 👇"); await sendCategories(sender); return; }

    switch (s.state) {
      case "await_track_id": await trackOrder(s, text); break;
      case "await_quantity": {
        if (GREETINGS.includes(lower)) { s.state = "menu"; await sendWelcome(s); break; }
        if (!s.draft.last_prod_id) { s.state = "shopping"; await sendCategories(sender); break; }
        const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
        if (!n || n < 1) { await sendText(sender, "Please type just a number, like 2 👇"); await sendQuantities(sender, s.draft.last_prod_id); break; }
        await addToCart(s, s.draft.last_prod_id, Math.min(n, 50));
        break;
      }
      case "await_complaint_order": s.draft.complaint_order = lower === "skip" ? null : text; s.state = "await_complaint_text"; await sendText(sender, "Please describe the issue and the team will look into it:"); break;
      case "await_complaint_text": await saveComplaint(s, text); break;
      case "review": if (GREETINGS.includes(lower)) { s.state = "menu"; await sendWelcome(s); break; }
        await sendOptions(sender, "Your order summary is above — tap 💳 Pay now when ready.", [{ title: "🏠 Start over", payload: "MENU" }, { title: "⬅️ Change delivery", payload: "CHECKOUT" }, { title: "✏️ Edit cart", payload: "EDIT_CART" }, { title: "💬 Talk to Staff", payload: "SUPPORT" }]); break;
      default:
        if (GREETINGS.includes(lower) || s.state === "menu") { s.state = "menu"; await sendWelcome(s); }
        else if (s.state === "shopping") { await sendText(sender, "I didn't quite catch that 🤔"); if (s.draft.last_prod_id) await sendQuantities(sender, s.draft.last_prod_id); else await sendCategories(sender); }
        else if (s.state === "awaiting_payment") { await sendOptions(sender, "Your payment link is above — tap it to complete your order, or use the options below.", [{ title: "🏠 Start over", payload: "MENU" }, { title: "✏️ Edit cart", payload: "EDIT_CART" }, { title: "💬 Talk to Staff", payload: "SUPPORT" }]); }
        else { s.state = "menu"; await sendWelcome(s); }
    }
  } finally { await saveSession(s); }
}

async function handleAnyMessage(sender: string) {
  const s = await loadSession(sender);
  try { if (s.handoff) return; if (s.state === "menu") await sendWelcome(s); } finally { await saveSession(s); }
}

// ───────────────────────────── screens ─────────────────────────────
async function sendWelcome(s: Session) {
  const sender = s.sender_id;
  await sendCard(sender, {
    title: "Welcome to Diamond Taste 🍰",
    subtitle: "We make milkcakes, cake tubs and cheesecakes, and deliver across Abuja.\n\nTap a button below.",
    buttons: [btn("🛍️ Order Cakes", "SHOP"), btn("🎂 Birthday Cake Order", "BIRTHDAY"), btn("📦 Track My Order", "TRACK")],
  });
  await sendOptions(sender, "More options:", [{ title: "💬 Talk to Staff", payload: "SUPPORT" }]);
}

// Birthday cakes are taken on WhatsApp only — send them straight there with a button.
async function sendBirthdayWhatsApp(sender: string) {
  await sendButtonsWithUrl(sender, {
    title: "Birthday cakes 🎂",
    subtitle: "We make birthday cakes to order on WhatsApp, not here. Tap the button to chat with us and we'll sort out your cake.",
    url: WHATSAPP_LINK,
    urlTitle: "💬 Message Us on WhatsApp",
  });
  return sendOptions(sender, "Or:", [{ title: "🛍️ Order Other Cakes", payload: "SHOP" }, { title: "🏠 Home", payload: "MENU" }]);
}

function sendShopChoice(sender: string) {
  return sendInstagram(sender, { attachment: { type: "template", payload: { template_type: "generic", elements: [{
    title: "Where do you want to order?",
    subtitle: "Order on our website, or order here in this chat.",
    buttons: [{ type: "web_url", title: "🌐 Our Website", url: WEBSITE }, { type: "postback", title: "💬 Order Here", payload: "SHOP_HERE" }],
  }] } } });
}

async function sendCategories(sender: string) {
  const cats = await getCategoryCards();
  if (cats.length === 0) return sendText(sender, "Our menu is being updated right now. Please check back soon.");
  const elements = cats.map((c) => ({
    title: c.name,
    subtitle: `${c.count} to choose from. Tap to see them.`.slice(0, 80),
    image_url: c.image || undefined,
    buttons: [btn("👀 See These", `CAT::${c.name}`)],
  }));
  await sendCarousel(sender, elements);
  return sendOptions(sender, "Tap a group above to see the cakes.", [{ title: "💬 Talk to Staff", payload: "SUPPORT" }, { title: "🏠 Home", payload: "MENU" }]);
}

async function sendProducts(sender: string, cat: string) {
  const list = (await getProductsByCategory(cat)).filter(inStock);
  if (list.length === 0) return sendText(sender, "Nothing in this group right now. Type 'menu' to start again.");
  const elements = list.map((p) => ({
    title: `${p.name} — ${naira(p.price)}`,
    subtitle: "Tap the button to add this to your cart.",
    image_url: p.image || undefined,
    buttons: [btn("🛒 Add to Cart", `PROD::${p.id}`)],
  }));
  await sendCarousel(sender, elements);
  return sendOptions(sender, "Or pick one of these:", [{ title: "⬅️ Back to Groups", payload: "SHOP_HERE" }, { title: "🛒 View My Cart", payload: "CART" }, { title: "🏠 Home", payload: "MENU" }]);
}

async function sendQuantities(sender: string, id: string) {
  const p = await getProduct(id);
  if (!p) return sendCategories(sender);
  const stockNote = p.stock !== null ? ` (only ${p.stock} left)` : "";
  await sendText(sender, `How many of ${p.name} would you like?${stockNote}\n\nJust type the number — for example, 2.`);
  return sendOptions(sender, "Or:", [{ title: "🏠 Home", payload: "MENU" }]);
}

async function addToCart(s: Session, id: string, qty: number) {
  const p = await getProduct(id);
  if (!p) return sendCategories(s.sender_id);
  if (!inStock(p)) return sendText(s.sender_id, `Sorry, ${p.name} is sold out. Type 'menu' to pick something else.`);
  const finalQty = p.stock === null ? qty : Math.min(qty, p.stock);
  if (finalQty < qty) await sendText(s.sender_id, `We only have ${finalQty} of ${p.name} left, so I've added ${finalQty}.`);
  const existing = s.cart.find((l) => l.product_id === id);
  if (existing) existing.qty += finalQty;
  else s.cart.push({ product_id: id, name: p.name, qty: finalQty, price: p.price });
  s.state = "shopping"; s.draft.last_prod_id = undefined;
  await sendCard(s.sender_id, {
    title: "Added to your cart ✅",
    subtitle: `${finalQty} × ${p.name}\nCart total: ${naira(cartTotal(s))}`,
    buttons: [btn("✅ Pay / Checkout", "CHECKOUT"), btn("➕ Add Another Cake", "SHOP"), btn("🛒 View My Cart", "CART")],
  });
  return sendOptions(s.sender_id, "Or:", [{ title: "💬 Talk to Staff", payload: "SUPPORT" }, { title: "🏠 Home", payload: "MENU" }]);
}

async function sendCart(s: Session) {
  const sender = s.sender_id;
  if (s.cart.length === 0) return sendCard(sender, { title: "Your cart is empty 🛒", subtitle: "Add a cake to get started.", buttons: [btn("🛍️ Order Cakes", "SHOP"), btn("🏠 Home", "MENU")] });
  const lines = s.cart.map((l) => `• ${l.qty} × ${l.name} — ${naira(l.price * l.qty)}`).join("\n");
  const hint = cartTotal(s) >= FREE_DELIVERY_MIN ? "\n\n🎉 You get FREE delivery!" : `\n\nSpend ${naira(FREE_DELIVERY_MIN - cartTotal(s))} more to get FREE delivery 🚚`;
  await sendCard(sender, { title: `Your cart — ${naira(cartTotal(s))}`, subtitle: (lines + hint).slice(0, 640), buttons: [btn("✅ Pay / Checkout", "CHECKOUT"), btn("✏️ Change Cart", "EDIT_CART")] });
  return sendOptions(sender, "Or:", [{ title: "➕ Add Another Cake", payload: "SHOP" }, { title: "💬 Talk to Staff", payload: "SUPPORT" }, { title: "🏠 Home", payload: "MENU" }]);
}

async function sendEditCart(s: Session) {
  const sender = s.sender_id;
  if (s.cart.length === 0) return sendCart(s);
  const elements: any[] = s.cart.map((l, idx) => ({ title: `${l.name} — ${naira(l.price * l.qty)}`, subtitle: `Qty: ${l.qty} × ${naira(l.price)}`, buttons: [btn("➖ Remove 1", `REDUCE::${idx}`), btn("🗑️ Remove All", `REMOVE::${idx}`)] }));
  elements.push({ title: `Total: ${naira(cartTotal(s))}`, subtitle: "All done?", buttons: [btn("✅ Pay / Checkout", "CHECKOUT"), btn("🛒 View My Cart", "CART")] });
  await sendCarousel(sender, elements);
  return sendOptions(sender, "Or:", [{ title: "➕ Add Another Cake", payload: "SHOP" }, { title: "🏠 Home", payload: "MENU" }]);
}
async function removeFromCart(s: Session, idx: number) { if (s.cart[idx]) s.cart.splice(idx, 1); await saveSession(s); await sendText(s.sender_id, "✓ Item removed."); return sendEditCart(s); }
async function reduceQuantity(s: Session, idx: number) { if (s.cart[idx]) { s.cart[idx].qty -= 1; if (s.cart[idx].qty <= 0) s.cart.splice(idx, 1); await saveSession(s); } await sendText(s.sender_id, s.cart.length ? "✓ Quantity updated." : "✓ Cart is now empty."); return sendEditCart(s); }

async function askFulfilment(s: Session) {
  if (s.cart.length === 0) return sendCart(s);
  return sendOptions(s.sender_id, "How do you want to get your order?", [
    { title: "🚚 Deliver to Me", payload: "FULFIL::delivery" },
    { title: "🏪 I'll Pick It Up", payload: "FULFIL::pickup" },
    { title: "⬅️ Back to Cart", payload: "CART" },
    { title: "💬 Talk to Staff", payload: "SUPPORT" },
    { title: "🏠 Home", payload: "MENU" },
  ]);
}

async function chooseFulfilment(s: Session, method: string) {
  const sender = s.sender_id;
  if (s.cart.length === 0) return sendCart(s);
  if (method === "pickup") {
    s.draft.method = "pickup"; s.draft.area_fee = 0; s.draft.area_id = undefined; s.draft.area_name = undefined;
    await sendText(sender, `Pickup selected 🏪\n📍 ${await getPickupAddress()}\n\nWe currently serve Abuja only.`);
    return sendSummary(s);
  }
  s.draft.method = "delivery";
  await sendText(sender, "📍 We deliver within Abuja only. Pick your area 👇");
  return sendAreasPage(sender, 0);
}

async function sendAreasPage(sender: string, page: number) {
  const areas = await getAreas();
  const PAGE = 9, start = page * PAGE, slice = areas.slice(start, start + PAGE), hasMore = start + PAGE < areas.length;
  if (slice.length === 0) return sendText(sender, "No delivery areas configured yet — tap 💬 Talk to Staff.");
  const replies = slice.map((a) => ({ title: `${a.location} ${naira(a.fee)}`.slice(0, 20), payload: `AREA::${a.id}` }));
  if (page > 0) replies.unshift({ title: "◀️ Back", payload: `AREA_PAGE::${page - 1}` });
  if (hasMore) replies.push({ title: "More ▶️", payload: `AREA_PAGE::${page + 1}` });
  replies.push({ title: "🏠 Home", payload: "MENU" });
  return sendOptions(sender, `Select your delivery area (page ${page + 1}). Free delivery on orders over ₦20,000.`, replies);
}

async function chooseArea(s: Session, id: string) {
  const a = await getArea(id);
  if (!a) return askFulfilment(s);
  s.draft.method = "delivery"; s.draft.area_id = a.id; s.draft.area_name = a.location; s.draft.area_fee = a.fee;
  await sendText(s.sender_id, `📍 ${a.location} selected.`);
  return sendSummary(s);
}

async function sendSummary(s: Session) {
  const d = s.draft; s.state = "review";
  const subtotal = cartTotal(s);
  const { deliveryFee, serviceFee, free } = d.method === "delivery" ? deliveryBreakdown(subtotal, d.area_fee || 0) : { deliveryFee: 0, serviceFee: 0, free: false };
  const total = subtotal + deliveryFee + serviceFee;
  const items = s.cart.map((l) => `• ${l.qty} × ${l.name} — ${naira(l.price * l.qty)}`).join("\n");
  const fulfil = d.method === "pickup" ? `🏪 Pickup — ${await getPickupAddress()}` : `🚚 ${d.area_name} — ${free ? "FREE" : naira(deliveryFee)}`;
  const lines = [
    items, "",
    `Subtotal: ${naira(subtotal)}`,
    d.method === "delivery" ? `Delivery: ${free ? "FREE 🎉" : naira(deliveryFee)}` : null,
    serviceFee > 0 ? `Service fee: ${naira(serviceFee)}` : null,
    `*Total: ${naira(total)}*`, "", fulfil,
  ].filter((x) => x !== null).join("\n");
  await sendCard(s.sender_id, { title: `Total to pay: ${naira(total)}`, subtitle: lines.slice(0, 640), buttons: [btn("💳 Pay Now", "PAY"), btn("🔁 Start Over", "MENU")] });
  return sendOptions(s.sender_id, "Ready to pay?", [{ title: "💳 Pay Now", payload: "PAY" }, { title: "⬅️ Change Delivery", payload: "CHECKOUT" }, { title: "💬 Talk to Staff", payload: "SUPPORT" }, { title: "🏠 Home", payload: "MENU" }]);
}

async function askOrPay(s: Session) {
  if (s.cart.length === 0) return sendCart(s);
  const saved = s.saved_details;
  if (!saved?.name && !saved?.phone) return sendPaymentLink(s, false);
  const lines = [saved.name ? `👤 ${saved.name}` : null, saved.phone ? `📞 ${saved.phone}` : null, saved.email ? `📧 ${saved.email}` : null, s.draft.method === "delivery" && saved.address ? `📍 ${saved.address}` : null].filter(Boolean).join("\n");
  return sendCard(s.sender_id, { title: "Use your saved details?", subtitle: lines.slice(0, 640), buttons: [btn("✅ Yes, Pay Now", "PAY_SAVED"), btn("✏️ Change Details", "PAY_NEW"), btn("🏠 Home", "MENU")] });
}

async function createPaymentPage(s: Session, useSaved: boolean): Promise<string | null> {
  const subtotal = cartTotal(s);
  const { deliveryFee, serviceFee } = s.draft.method === "delivery" ? deliveryBreakdown(subtotal, s.draft.area_fee || 0) : { deliveryFee: 0, serviceFee: 0 };
  const total = subtotal + deliveryFee + serviceFee; // kobo
  const saved = useSaved ? (s.saved_details ?? null) : null;
  const custom_fields: any[] = [
    { display_name: "Full Name", variable_name: "full_name", value: saved?.name || "" },
    { display_name: "Phone Number", variable_name: "phone_number", value: saved?.phone || "" },
  ];
  if (s.draft.method === "delivery") custom_fields.push({ display_name: "Delivery Address", variable_name: "delivery_address", value: saved?.address || "" });
  const body: any = {
    name: "Diamond Taste Order",
    description: s.cart.map((l) => `${l.qty}x ${l.name}`).join(", ").slice(0, 240),
    amount: total, // already kobo
    currency: "NGN",
    metadata: {
      ig_sender_id: s.sender_id, platform: "instagram", cart: s.cart, subtotal,
      delivery_method: s.draft.method || "pickup", delivery_fee: deliveryFee, service_fee: serviceFee,
      delivery_area: s.draft.area_name || null,
      ...(saved ? { customer_name: saved.name || null, customer_phone: saved.phone || null, customer_email: saved.email || null, customer_address: saved.address || null } : {}),
    },
    custom_fields,
  };
  if (PAYSTACK_SUBACCOUNT) { body.subaccount = PAYSTACK_SUBACCOUNT; body.bearer = "subaccount"; }
  try {
    const res = await fetch("https://api.paystack.co/page", { method: "POST", headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || !data?.data?.slug) { console.error("[DT] Paystack page error:", JSON.stringify(data)); return null; }
    const slug = data.data.slug;
    try { await supabase.from("diamond_bot_payments").insert({ sender_id: s.sender_id, reference: slug, cart: s.cart, delivery_method: s.draft.method || "pickup", delivery_fee: deliveryFee, service_fee: serviceFee, area: s.draft.area_name || null }); }
    catch (err) { console.error("[DT] save payment mapping failed:", err); }
    return `https://paystack.com/pay/${slug}`;
  } catch (e) { console.error("[DT] createPaymentPage failed:", e); return null; }
}

async function sendPaymentLink(s: Session, useSaved: boolean) {
  if (s.cart.length === 0) return sendCart(s);
  const subtotal = cartTotal(s);
  const { deliveryFee, serviceFee } = s.draft.method === "delivery" ? deliveryBreakdown(subtotal, s.draft.area_fee || 0) : { deliveryFee: 0, serviceFee: 0 };
  const total = subtotal + deliveryFee + serviceFee;
  const url = await createPaymentPage(s, useSaved);
  if (!url) return sendText(s.sender_id, "Sorry, we couldn't start the payment just now. Please tap *💳 Pay Now* again in a moment.");
  s.state = "awaiting_payment";
  const hint = useSaved ? "Your saved details are filled in already — just check and pay." : "You'll type your name, phone" + (s.draft.method === "delivery" ? ", delivery address" : "") + " and email on the safe Paystack page.";
  await sendButtonsWithUrl(s.sender_id, { title: `Pay ${naira(total)} safely`, subtitle: `Pay by card, bank transfer or USSD. ${hint}`, url, urlTitle: "💳 Pay Now" });
  return sendOptions(s.sender_id, "Or:", [{ title: "🏠 Start Over", payload: "MENU" }, { title: "✏️ Change Cart", payload: "EDIT_CART" }, { title: "💬 Talk to Staff", payload: "SUPPORT" }]);
}

// ───────────────────────────── orders / tracking ─────────────────────────────
const STATUS: Record<string, string> = { pending: "⏳ Pending", confirmed: "✅ Confirmed", baking: "👩‍🍳 Baking", ready: "📦 Ready", completed: "🎉 Completed", cancelled: "❌ Cancelled" };

async function trackOrder(s: Session, raw: string) {
  const sender = s.sender_id, id = raw.trim().toUpperCase();
  if (!/^DT-[A-Z0-9]+$/.test(id)) return sendOptions(sender, "That doesn't look like an order ID. It should look like DT-A2K9P. Please type it again, or tap Home.", [{ title: "💬 Talk to Staff", payload: "SUPPORT" }, { title: "🏠 Home", payload: "MENU" }]);
  s.state = "menu";
  const { data: order } = await supabase.from("diamond_orders").select("order_number, status, items, total_price").eq("order_number", id).maybeSingle();
  if (!order) return sendCard(sender, { title: "Order not found 🤔", subtitle: `We couldn't find ${id}. Double-check the ID from your confirmation.`, buttons: [btn("🏠 Home", "MENU")] });
  const itemsSummary = Array.isArray(order.items) ? order.items.map((i: any) => `${i.quantity ?? 1}× ${i.name}`).join(", ") : "";
  return sendCard(sender, { title: `${order.order_number} — ${STATUS[order.status] || order.status?.toUpperCase()}`, subtitle: `${itemsSummary}\nTotal: ${naira(order.total_price)}`.slice(0, 640), buttons: [btn("🛍️ Order Again", "SHOP"), btn("💬 Talk to Staff", "SUPPORT"), btn("🏠 Home", "MENU")] });
}

async function sendOrdersCarousel(sender: string) {
  const { data: orders } = await supabase.from("diamond_orders").select("order_number, status, items, total_price, created_at").eq("ig_sender_id", sender).order("created_at", { ascending: false }).limit(10);
  if (!orders || orders.length === 0) return sendCard(sender, { title: "No orders found 📦", subtitle: "We couldn't find orders linked to this chat yet. Have your order ID? Tap Track Order.", buttons: [btn("📦 Track Order", "TRACK"), btn("🛍️ See Our Cakes", "SHOP"), btn("🏠 Home", "MENU")] });
  const elements = orders.map((o: any) => {
    const itemsSummary = Array.isArray(o.items) ? o.items.map((i: any) => `${i.quantity ?? 1}× ${i.name}`).join(", ") : "Order items";
    return { title: `${o.order_number} — ${STATUS[o.status] || o.status?.toUpperCase()}`, subtitle: `${itemsSummary}\nTotal: ${naira(o.total_price)}`.slice(0, 640), buttons: [btn("💬 Talk to Staff", "SUPPORT"), btn("🛍️ Order Again", "SHOP")] };
  });
  await sendCarousel(sender, elements);
  return sendOptions(sender, "Or:", [{ title: "💬 Talk to Staff", payload: "SUPPORT" }, { title: "🏠 Home", payload: "MENU" }]);
}

async function saveComplaint(s: Session, text: string) {
  try { await supabase.from("diamond_bot_complaints").insert({ sender_id: s.sender_id, order_number: s.draft.complaint_order ?? null, message: text }); } catch (e) { console.error("[DT] saveComplaint", e); }
  s.state = "menu"; s.draft.complaint_order = undefined;
  return sendCard(s.sender_id, { title: "Complaint received ✅", subtitle: "Thank you — the Diamond Taste team has been notified and will reach out shortly.", buttons: [btn("🏠 Home", "MENU")] });
}

// ───────────────────────────── human handoff ─────────────────────────────
function sendSupportDisclaimer(sender: string) {
  return sendCard(sender, { title: "💬 Talk to Our Staff", subtitle: "Want to order, track an order, or see our cakes? The buttons do that for you fast.\n\nStill want to chat with a real person? Tap below and a Diamond Taste staff member will reply right here.", buttons: [btn("✅ Yes, Connect Me", "HANDOFF_CONFIRM"), btn("🏠 Home", "MENU")] });
}
async function confirmHandoff(s: Session) {
  s.handoff = true; s.handoff_at = new Date().toISOString(); s.state = "human";
  await notifyShopByEmail(s);
  return sendOptions(s.sender_id, "✅ You're connected! A Diamond Taste staff member will reply here soon. Type your message below — the bot is paused for now.", [{ title: "🏠 Home", payload: "MENU" }]);
}
async function notifyShopByEmail(s: Session) {
  if (!RESEND_API_KEY) { console.warn("[DT] RESEND_API_KEY not set — skipping support email"); return; }
  const name = s.saved_details?.name || "Unknown", phone = s.saved_details?.phone || "N/A";
  try {
    await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({
      from: SHOP_FROM_EMAIL, to: [SHOP_SUPPORT_EMAIL], subject: "🔔 Customer needs human support — Diamond Taste Bot",
      html: `<h2>A customer requested a human agent</h2><p><strong>Name:</strong> ${name}</p><p><strong>Phone:</strong> ${phone}</p><p><strong>Instagram Sender ID:</strong> <code>${s.sender_id}</code></p><p style="margin:24px 0;"><a href="https://www.instagram.com/direct/t/${s.sender_id}" style="background:#EC008C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">💬 Open Instagram Chat</a></p><p>The bot is paused for this customer.</p><hr/><p style="color:#888;font-size:12px;">To re-enable: set handoff=false in diamond_bot_sessions where sender_id='${s.sender_id}'.</p>`,
    }) });
  } catch (e) { console.error("[DT] notifyShopByEmail failed:", e); }
}

// ───────────────────────────── Instagram Send API ─────────────────────────────
type PostbackButton = { type: "postback"; title: string; payload: string };
type UrlButton = { type: "web_url"; title: string; url: string };
type AnyButton = PostbackButton | UrlButton;
const btn = (title: string, payload: string): PostbackButton => ({ type: "postback", title, payload });

function sendCard(sender: string, el: { title: string; subtitle?: string; buttons: AnyButton[] }) {
  return sendInstagram(sender, { attachment: { type: "template", payload: { template_type: "generic", elements: [el] } } });
}
function sendCarousel(sender: string, elements: any[]) {
  return sendInstagram(sender, { attachment: { type: "template", payload: { template_type: "generic", elements: elements.slice(0, 10) } } });
}
// Renders tappable options as a carousel of cards (max 3 buttons per card) so the
// options are big and obvious — never the easy-to-miss quick-reply chips.
function sendOptions(sender: string, text: string, replies: { title: string; payload: string }[]) {
  const cards: any[] = [];
  for (let i = 0; i < replies.length; i += 3) {
    cards.push({
      title: (i === 0 ? text : "More options").slice(0, 80),
      buttons: replies.slice(i, i + 3).map((r) => btn(r.title.slice(0, 20), r.payload)),
    });
  }
  return sendCarousel(sender, cards.slice(0, 10));
}
function sendButtonsWithUrl(sender: string, o: { title: string; subtitle?: string; url: string; urlTitle: string }) {
  return sendInstagram(sender, { attachment: { type: "template", payload: { template_type: "generic", elements: [{ title: o.title, subtitle: o.subtitle, buttons: [{ type: "web_url", title: o.urlTitle, url: o.url }] }] } } });
}
function sendText(sender: string, text: string) { return sendInstagram(sender, { text }); }

async function sendSenderAction(recipientId: string, action: "typing_on" | "typing_off") {
  try {
    await fetch(`https://graph.instagram.com/v25.0/${TEST_ID}/messages`, { method: "POST", headers: { Authorization: `Bearer ${TEST_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ recipient: { id: recipientId }, sender_action: action }) });
  } catch (e) { console.error(`[DT] sendSenderAction ${action}`, e); }
}

async function sendInstagram(recipientId: string, message: Record<string, unknown>) {
  await sendSenderAction(recipientId, "typing_off");
  await logMessage(recipientId, "out", (message as any).attachment ? "template" : "text", JSON.stringify(message).slice(0, 200), message);
  const res = await fetch(`https://graph.instagram.com/v25.0/${TEST_ID}/messages`, { method: "POST", headers: { Authorization: `Bearer ${TEST_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ recipient: { id: recipientId }, message }) });
  const data = await res.json();
  if (!res.ok) { console.error("[DT] IG API error:", JSON.stringify(data)); throw new Error(`Instagram API ${res.status}`); }
  return data;
}
