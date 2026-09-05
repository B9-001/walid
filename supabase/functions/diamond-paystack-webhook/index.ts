// thepufflette.co — Paystack webhook (server-side order backstop).
//
// Paystack calls this on every charge.success. The website already creates the
// order client-side the instant payment succeeds, so normally this webhook finds
// the order already exists and does nothing. Its job is the safety net: if the
// customer's browser closed/crashed in the ~1s before the client-side save
// finished, THIS recreates the paid order from the payment metadata so no paid
// order is ever lost.
//
// It is idempotent (skips any reference already saved) so it can never create a
// duplicate alongside the client-side save. It authenticates via Paystack's HMAC
// signature (not a Supabase JWT), so it must be deployed with verify_jwt = false.
//
// Secrets: DT_PAYSTACK_SECRET (live secret key for signature checks; optional
//   DT_PAYSTACK_LIVE as a second accepted key), FB_CAPI_TOKEN (same Meta
//   Conversions API token as the Next.js app's FB_CAPI_TOKEN — set it here
//   too via `supabase secrets set`, it's a separate secrets store from
//   Vercel), optional FB_TEST_EVENT_CODE (see the constant below — only set
//   while testing in Meta Events Manager, unset afterward), and auto-injected
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYSTACK_SECRET = Deno.env.get("DT_PAYSTACK_SECRET") || "";
const PAYSTACK_SECRET_2 = Deno.env.get("DT_PAYSTACK_LIVE") || "";
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/diamond-send-order-email`;

// Same public pixel ID as lib/meta.ts (hardcoded there for the same reason:
// it's public, ships in the client snippet, so a stale env var can't break it).
const FB_PIXEL_ID = "1422886952986930";
const FB_CAPI_TOKEN = Deno.env.get("FB_CAPI_TOKEN") || "";
// Unset in normal operation — only set (via `supabase secrets set`) while
// watching Events Manager -> Test Events, then unset it again. Leaving it
// set permanently tags every real recovered-order Purchase as a test event,
// silently excluding it from ad optimization.
const FB_TEST_EVENT_CODE = Deno.env.get("FB_TEST_EVENT_CODE") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Random DT-XXXXXX order number (same alphabet/format the website uses).
const ORDER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateOrderNumber(): string {
  const arr = new Uint32Array(6);
  crypto.getRandomValues(arr);
  let code = "";
  for (let i = 0; i < 6; i++) code += ORDER_ALPHABET[arr[i] % ORDER_ALPHABET.length];
  return `DT-${code}`;
}

async function sha256Hex(v: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Server-side Meta Purchase event for orders THIS webhook recovers. The
// client-side pixel/CAPI in components/diamond/OrderSuccess.tsx only fires
// once the customer reaches the success page — but that's exactly the case
// that never happens when we're here, so without this, every backstop-
// recovered order was a paid conversion Meta never heard about. event_id
// matches OrderSuccess.tsx's `purchase_${order_number}` scheme so a genuine
// double-fire (client succeeded after all) still dedupes on Meta's side.
async function sendMetaPurchase(order: { order_number: string; total_price: number; customer_email?: string; customer_phone?: string }) {
  if (!FB_CAPI_TOKEN) return;
  const userData: Record<string, string[]> = {};
  if (order.customer_email) userData.em = [await sha256Hex(order.customer_email)];
  if (order.customer_phone) userData.ph = [await sha256Hex(order.customer_phone.replace(/\D/g, ""))];

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${FB_PIXEL_ID}/events?access_token=${FB_CAPI_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: `purchase_${order.order_number}`,
          action_source: "website",
          user_data: userData,
          custom_data: { value: (order.total_price || 0) / 100, currency: "NGN" }, // kobo -> NGN
        }],
        ...(FB_TEST_EVENT_CODE ? { test_event_code: FB_TEST_EVENT_CODE } : {}),
      }),
    });
    if (!res.ok) console.error("[PS-WEBHOOK] Meta CAPI rejected the event:", await res.text());
  } catch (e) {
    console.error("[PS-WEBHOOK] Meta CAPI failed (non-fatal):", e);
  }
}

// HMAC SHA-512 of the raw body; true if it matches either configured key.
async function verifySignature(body: string, signature: string): Promise<boolean> {
  for (const key of [PAYSTACK_SECRET, PAYSTACK_SECRET_2]) {
    if (!key) continue;
    const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(body));
    const hash = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hash === signature) return true;
  }
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") return new Response("thepufflette.co Paystack webhook is ACTIVE.", { status: 200 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.text();
  const signature = req.headers.get("x-paystack-signature") || "";
  if (!(await verifySignature(body, signature))) {
    console.error("[PS-WEBHOOK] invalid signature");
    return new Response("Invalid signature", { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }
  if (event.event !== "charge.success") return new Response(JSON.stringify({ message: "ignored" }), { status: 200 });

  try { await handleChargeSuccess(event.data); }
  catch (err) { console.error("[PS-WEBHOOK] processing error:", err); }
  // Always 200 so Paystack doesn't retry endlessly on our internal errors.
  return new Response(JSON.stringify({ message: "processed" }), { status: 200, headers: { "Content-Type": "application/json" } });
});

async function handleChargeSuccess(data: any) {
  const reference: string = data.reference;
  const amount: number = data.amount || 0; // KOBO — DB stores kobo, so no division

  // Paystack sometimes delivers metadata as a JSON *string* — parse it or every
  // field reads as undefined and the order reconstructs empty.
  let meta: any = data.metadata || {};
  if (typeof meta === "string") {
    try { meta = JSON.parse(meta); } catch { meta = {}; }
  }

  // Idempotency: the website almost always saved this already. Skip if so — this
  // is what prevents a duplicate of the client-side order.
  const { data: existing } = await supabase.from("diamond_orders").select("id, order_number").eq("payment_reference", reference).maybeSingle();
  if (existing) { console.log(`[PS-WEBHOOK] ${reference} already saved (${existing.order_number})`); return; }

  // Custom fields entered on the Paystack page → variable_name : value map.
  const cf: Record<string, string> = {};
  for (const f of (Array.isArray(meta.custom_fields) ? meta.custom_fields : [])) if (f?.variable_name) cf[f.variable_name] = f.value;

  // The website puts the whole order under meta.order.
  const o = (meta.order && typeof meta.order === "object") ? meta.order : {};

  const customerName = cf.customer_name || meta.customer_name || `${data.customer?.first_name || ""} ${data.customer?.last_name || ""}`.trim() || "Customer";
  const customerPhone = cf.phone || meta.customer_phone || data.customer?.phone || "";
  const customerEmail = data.customer?.email || meta.customer_email || cf.email || "";
  const deliveryMethod = o.delivery_method || meta.delivery_method || "pickup";
  const areaName = o.delivery_area || meta.delivery_area || null;
  const customerAddress = o.delivery_address || cf.address || meta.customer_address || null;

  // Cart from meta.order.items.
  let cart: any[] = [];
  if (Array.isArray(o.items) && o.items.length) cart = o.items;
  else if (Array.isArray(meta.cart)) cart = meta.cart;
  else if (typeof meta.cart === "string") { try { cart = JSON.parse(meta.cart); } catch { cart = []; } }

  const items = cart.map((l: any) => ({ product_id: l.product_id ?? null, name: l.name, quantity: l.qty ?? l.quantity ?? 1, price: l.price, image: l.image ?? null, ...(l.note ? { note: l.note } : {}), ...(l.flavor ? { flavor: l.flavor } : {}) }));
  const deliveryFee = Number(o.delivery_fee ?? meta.delivery_fee ?? 0) || 0;
  const serviceFee = Number(o.service_fee ?? meta.service_fee ?? 0) || 0;
  const couponCode = o.coupon_code ?? null;
  const couponDiscount = Number(o.discount ?? 0) || 0;
  const subtotal = Number(o.subtotal) || items.reduce((sum: number, it: any) => sum + Number(it.price) * Number(it.quantity), 0) || Math.max(0, amount - deliveryFee - serviceFee);

  // Create the order, retrying if the random DT-XXXXXX collides (unique → 23505).
  let order: any = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const orderNumber = generateOrderNumber();
    const { data: ins, error } = await supabase.from("diamond_orders").insert({
      order_number: orderNumber,
      customer_name: customerName,
      customer_email: customerEmail || "no-email@thepufflette.co",
      customer_phone: customerPhone,
      customer_address: deliveryMethod === "delivery" ? customerAddress : null,
      customer_city: deliveryMethod === "delivery" ? areaName : null,
      customer_state: deliveryMethod === "delivery" ? "Abuja" : null,
      delivery_method: deliveryMethod,
      delivery_fee: deliveryFee,
      service_fee: serviceFee,
      required_date: o.required_date ?? null,
      required_time: o.required_time ?? null,
      items,
      subtotal,
      coupon_code: couponCode,
      coupon_discount: couponDiscount,
      total_price: amount,
      status: "pending",
      payment_status: "paid",
      payment_reference: reference,
      notes: o.notes ?? null,
      referral_source: o.referral_source ?? null,
    }).select("order_number").single();
    if (!error) { order = ins; break; }
    if (error.code !== "23505") { console.error("[PS-WEBHOOK] order insert failed:", error); return; }
    // 23505 is shared by every unique constraint on the table, so the message
    // has to be inspected. Only an order_number collision is worth retrying.
    // A payment_reference collision means the website saved this order in the
    // gap between our idempotency check and this insert — the client owns it
    // from here (including the confirmation email), so stop rather than
    // burning five more inserts and logging a bogus failure.
    if (error.message?.includes("payment_reference")) {
      console.log(`[PS-WEBHOOK] ${reference} saved by the website mid-insert — nothing to recover`);
      return;
    }
  }
  if (!order) { console.error("[PS-WEBHOOK] could not generate a unique order number"); return; }
  console.log(`[PS-WEBHOOK] recovered order ${order.order_number} for ${reference}`);

  // The customer never reached the client-side success page (that's why we're
  // recovering this order at all), so fire the Purchase event server-side —
  // otherwise this paid conversion would never reach Meta.
  await sendMetaPurchase({ order_number: order.order_number, total_price: amount, customer_email: customerEmail, customer_phone: customerPhone });

  // Count the voucher redemption. The website does this itself after a normal
  // save, but we only get here when it never ran — so without this a
  // single-use voucher used on a recovered order stayed redeemable forever.
  if (couponCode) {
    try {
      const { data: coupon } = await supabase
        .from("diamond_coupons").select("id").eq("code", couponCode).maybeSingle();
      if (coupon) await supabase.rpc("diamond_increment_coupon_usage", { p_coupon_id: coupon.id });
    } catch (e) { console.error("[PS-WEBHOOK] coupon usage increment failed:", e); }
  }

  // Stock is decremented by a DB trigger on insert (shared with website orders).
  // Fire the same admin + customer email as a normal order.
  if (customerEmail) {
    try {
      await fetch(SEND_EMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
        body: JSON.stringify({ order_number: order.order_number }),
      });
    } catch (e) { console.error("[PS-WEBHOOK] email failed (non-fatal):", e); }
  }
}
