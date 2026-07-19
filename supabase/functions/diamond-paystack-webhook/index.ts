// Diamond Taste — Paystack webhook.
//
// On charge.success: verify signature → (idempotent) create a diamond_orders row
// with a DT-XXXXXX order number → decrement stock_level → email the customer +
// Diamond Taste (via diamond-send-order-email) → DM the customer their tracking
// number on Instagram → clear the bot session and remember their details.
//
// This is what turns a PAID chatbot order into a real order, so IG orders behave
// exactly like website orders. Money is in KOBO throughout (matches the DB).
//
// Secrets: DT_PAYSTACK_SECRET (+ optional DT_PAYSTACK_LIVE) for signature checks,
//   TEST_TOKEN, TEST_ID for the IG DM, and auto-injected SUPABASE_URL +
//   SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYSTACK_TEST = Deno.env.get("DT_PAYSTACK_SECRET") || "";
const PAYSTACK_LIVE = Deno.env.get("DT_PAYSTACK_LIVE") || "";
const TOKEN = Deno.env.get("TEST_TOKEN")!;
const IG_ID = Deno.env.get("TEST_ID")!;
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/diamond-send-order-email`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;

// Random DT-XXXXXX order number (same alphabet/format the website uses).
const ORDER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateOrderNumber(): string {
  const arr = new Uint32Array(6);
  crypto.getRandomValues(arr);
  let code = "";
  for (let i = 0; i < 6; i++) code += ORDER_ALPHABET[arr[i] % ORDER_ALPHABET.length];
  return `DT-${code}`;
}

// HMAC SHA-512 of the raw body; true if it matches either key's signature.
async function verifySignature(body: string, signature: string): Promise<boolean> {
  for (const key of [PAYSTACK_TEST, PAYSTACK_LIVE]) {
    if (!key) continue;
    const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(body));
    const hash = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hash === signature) return true;
  }
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") return new Response("Diamond Taste Paystack webhook is ACTIVE.", { status: 200 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.text();
  const signature = req.headers.get("x-paystack-signature") || "";
  if (!(await verifySignature(body, signature))) {
    console.error("[DT-WEBHOOK] invalid signature");
    return new Response("Invalid signature", { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }
  if (event.event !== "charge.success") return new Response(JSON.stringify({ message: "ignored" }), { status: 200 });

  try { await handleChargeSuccess(event.data); }
  catch (err) { console.error("[DT-WEBHOOK] processing error:", err); }
  // Always 200 so Paystack doesn't retry endlessly on our internal errors.
  return new Response(JSON.stringify({ message: "processed" }), { status: 200, headers: { "Content-Type": "application/json" } });
});

async function handleChargeSuccess(data: any) {
  const reference: string = data.reference;
  const amount: number = data.amount || 0; // KOBO — DB stores kobo, so no division
  // Paystack sometimes delivers metadata as a JSON *string* (seen on popup
  // bank-transfer charges, e.g. DT-FBTQ3W 2026-07-06). Parse it or every
  // field reads as undefined and the order reconstructs empty ("Customer",
  // no items, pickup).
  let meta: any = data.metadata || {};
  if (typeof meta === "string") {
    try { meta = JSON.parse(meta); } catch { meta = {}; }
  }

  // Idempotency: Paystack retries webhooks. Skip if this reference already became an order.
  const { data: existing } = await supabase.from("diamond_orders").select("id, order_number").eq("payment_reference", reference).maybeSingle();
  if (existing) { console.log(`[DT-WEBHOOK] ${reference} already processed (${existing.order_number})`); return; }

  // Recover the payment-page slug from the referrer (the transaction reference differs
  // from the slug the bot stored, so we match on the slug).
  const referrer = meta.referrer || "";
  const slugMatch = referrer.match(/paystack\.(?:shop|com)\/pay\/([a-z0-9]+)/i);
  const pageSlug = slugMatch?.[1] || null;

  let igSender: string | null = null;
  let paymentRecord: any = null;
  if (pageSlug) {
    const { data: pmt } = await supabase.from("diamond_bot_payments").select("*").eq("reference", pageSlug).maybeSingle();
    if (pmt) { igSender = pmt.sender_id; paymentRecord = pmt; }
    else console.warn(`[DT-WEBHOOK] No diamond_bot_payments record for slug=${pageSlug}`);
  }
  if (!igSender && meta.ig_sender_id) igSender = String(meta.ig_sender_id);

  // Custom fields entered on the Paystack page → variable_name : value map.
  const cf: Record<string, string> = {};
  for (const f of (Array.isArray(meta.custom_fields) ? meta.custom_fields : [])) if (f?.variable_name) cf[f.variable_name] = f.value;

  // Website orders carry the whole order under meta.order; Instagram-bot orders use the
  // payment record / flatter metadata. Prefer meta.order when present.
  const o = (meta.order && typeof meta.order === "object") ? meta.order : {};

  const customerName = cf.full_name || cf.customer_name || meta.customer_name || `${data.customer?.first_name || ""} ${data.customer?.last_name || ""}`.trim() || "Customer";
  const customerPhone = cf.phone_number || cf.phone || meta.customer_phone || data.customer?.phone || "";
  const customerEmail = data.customer?.email || meta.customer_email || cf.email || "";
  const deliveryMethod = o.delivery_method || paymentRecord?.delivery_method || meta.delivery_method || "pickup";
  const areaName = o.delivery_area || paymentRecord?.area || meta.delivery_area || null;
  const customerAddress = o.delivery_address || cf.delivery_address || cf.address || meta.customer_address || (deliveryMethod === "pickup" ? "Store pickup — Abuja" : "");

  // Cart: website meta.order.items (preferred), else IG payment record / meta.cart.
  let cart: any[] = [];
  if (Array.isArray(o.items) && o.items.length) cart = o.items;
  else if (paymentRecord?.cart?.length) cart = paymentRecord.cart;
  else if (Array.isArray(meta.cart)) cart = meta.cart;
  else if (typeof meta.cart === "string") { try { cart = JSON.parse(meta.cart); } catch { cart = []; } }

  const items = cart.map((l: any) => ({ product_id: l.product_id ?? null, name: l.name, quantity: l.qty ?? l.quantity ?? 1, price: l.price, image: l.image ?? null }));
  const deliveryFee = Number(o.delivery_fee ?? paymentRecord?.delivery_fee ?? meta.delivery_fee ?? 0) || 0;
  const serviceFee = Number(o.service_fee ?? paymentRecord?.service_fee ?? meta.service_fee ?? 0) || 0;
  const couponCode = o.coupon_code ?? null;
  const couponDiscount = Number(o.discount ?? 0) || 0;
  const subtotal = Number(o.subtotal) || items.reduce((sum: number, it: any) => sum + Number(it.price) * Number(it.quantity), 0) || Math.max(0, amount - deliveryFee - serviceFee);
  const requiredDate = o.required_date ?? null;
  const requiredTime = o.required_time ?? null;
  const orderNotes = o.notes ?? null;

  // Create the order, retrying if the random DT-XXXXXX collides (unique column → 23505).
  let order: any = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const orderNumber = generateOrderNumber();
    const { data: ins, error } = await supabase.from("diamond_orders").insert({
      order_number: orderNumber,
      customer_name: customerName,
      customer_email: customerEmail || "no-email@yourdomain.com",
      customer_phone: customerPhone,
      customer_address: deliveryMethod === "delivery" ? customerAddress : null,
      customer_city: deliveryMethod === "delivery" ? areaName : null,
      customer_state: deliveryMethod === "delivery" ? "Abuja" : null,
      delivery_method: deliveryMethod,
      delivery_fee: deliveryFee,
      service_fee: serviceFee,
      required_date: requiredDate,
      required_time: requiredTime,
      items,
      subtotal,
      coupon_code: couponCode,
      coupon_discount: couponDiscount,
      total_price: amount,
      status: "pending",
      payment_status: "paid",
      payment_reference: reference,
      notes: orderNotes,
      ig_sender_id: igSender,
      referral_source: o.referral_source ?? null,
    }).select("id, order_number").single();
    if (!error) { order = ins; break; }
    if (error.code !== "23505") { console.error("[DT-WEBHOOK] order insert failed:", error); return; }
  }
  if (!order) { console.error("[DT-WEBHOOK] could not generate a unique order number"); return; }
  const orderNumber = order.order_number;
  console.log(`[DT-WEBHOOK] order ${orderNumber} created for ${reference}`);

  // Stock is decremented by a DB trigger on diamond_orders insert (one source of truth
  // for both website and webhook orders) — no JS decrement here, to avoid double-cutting.
  if (customerEmail) await emailOrder({ orderNumber, customerName, customerEmail, customerPhone, deliveryMethod, items, subtotal, deliveryFee, total: amount, requiredDate });
  if (igSender) await dmCustomer(igSender, orderNumber, amount, deliveryMethod);

  // Clear the session and remember the customer's details for next time.
  if (igSender) {
    try {
      const saved: Record<string, string> = {};
      if (customerName && customerName !== "Instagram Customer") saved.name = customerName;
      if (customerPhone) saved.phone = customerPhone;
      if (customerEmail) saved.email = customerEmail;
      if (deliveryMethod === "delivery" && customerAddress) saved.address = customerAddress;
      await supabase.from("diamond_bot_sessions").upsert(
        { sender_id: igSender, state: "menu", cart: [], draft: {}, handoff: false, saved_details: Object.keys(saved).length ? saved : null },
        { onConflict: "sender_id" },
      );
    } catch (err) { console.error("[DT-WEBHOOK] clear session failed (non-fatal):", err); }
  }
}

// Reuse diamond-send-order-email (customer confirmation + Diamond Taste alert).
async function emailOrder(o: any) {
  try {
    const res = await fetch(SEND_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      body: JSON.stringify({
        order_number: o.orderNumber,
        name: o.customerName,
        email: o.customerEmail,
        phone: o.customerPhone,
        method: o.deliveryMethod,
        required_date: o.requiredDate ?? null,
        items: o.items,
        subtotal: o.subtotal,
        discount: 0,
        delivery_fee: o.deliveryFee,
        total: o.total,
      }),
    });
    if (!res.ok) console.error("[DT-WEBHOOK] send-order-email failed:", res.status, await res.text());
  } catch (e) { console.error("[DT-WEBHOOK] emailOrder error (non-fatal):", e); }
}

// DM the customer their tracking number on Instagram.
async function dmCustomer(sender: string, orderNumber: string, amount: number, deliveryMethod: string) {
  const info = deliveryMethod === "pickup"
    ? "🏪 Pickup — we'll message you when your order is ready to collect in Abuja."
    : "🚚 Delivery — our team will contact you to arrange your delivery in Abuja.";
  const text = `🎉 Payment confirmed! Your Diamond Taste order is being prepared.\n\n🧾 Order number: ${orderNumber}\n💰 Paid: ${naira(amount)}\n${info}\n\nSend this order number here anytime to check your status. Thank you for ordering with Diamond Taste 🍰`;
  try {
    const res = await fetch(`https://graph.instagram.com/v25.0/${IG_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: sender }, message: { text } }),
    });
    if (!res.ok) console.error("[DT-WEBHOOK] IG DM failed:", await res.text());
  } catch (e) { console.error("[DT-WEBHOOK] dmCustomer error (non-fatal):", e); }
}
