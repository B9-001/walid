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
//   DT_PAYSTACK_LIVE as a second accepted key) and auto-injected SUPABASE_URL +
//   SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYSTACK_SECRET = Deno.env.get("DT_PAYSTACK_SECRET") || "";
const PAYSTACK_SECRET_2 = Deno.env.get("DT_PAYSTACK_LIVE") || "";
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/diamond-send-order-email`;

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

  const items = cart.map((l: any) => ({ product_id: l.product_id ?? null, name: l.name, quantity: l.qty ?? l.quantity ?? 1, price: l.price, image: l.image ?? null, ...(l.note ? { note: l.note } : {}) }));
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
  }
  if (!order) { console.error("[PS-WEBHOOK] could not generate a unique order number"); return; }
  console.log(`[PS-WEBHOOK] recovered order ${order.order_number} for ${reference}`);

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
