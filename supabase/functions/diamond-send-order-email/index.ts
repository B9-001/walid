// thepufflette.co — New-order email.
//
// Called right after an order is saved (from the website checkout and from the
// Paystack webhook) with { order_number, ... }. It looks the order up with the
// service role (so the emailed details are authoritative, not caller-supplied),
// then:
//   1) ALWAYS emails the shop admin a "New order received" alert, and
//   2) best-effort emails the customer a branded confirmation.
//
// The admin recipient is the shop's contact email (Admin → Settings), falling
// back to the SHOP_ADMIN_EMAIL secret.
//
// Secrets: DT_RESEND_API_KEY (falls back to RESEND_API_KEY), DT_FROM_EMAIL,
//   optional SHOP_ADMIN_EMAIL, optional SITE_URL (defaults to
//   https://www.thepuffletteco.cc — the "View your order" button target),
//   and auto-injected SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. If no Resend
//   key is set the function returns a 200 with
//   { ok:false, reason:"email-not-configured" } so checkout never breaks —
//   it just means no email went out yet.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("DT_RESEND_API_KEY") || Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("DT_FROM_EMAIL") || "thepufflette.co <onboarding@resend.dev>";
const SHOP_ADMIN_EMAIL = Deno.env.get("SHOP_ADMIN_EMAIL") || "";
// For bank transfer/USSD payments Paystack often confirms AFTER the customer
// has left the browser tab (they're off completing the transfer elsewhere),
// so the client-side redirect to /order-success never fires — this email is
// the only thing that reaches them, so it needs its own way back to the site.
const SITE_URL = Deno.env.get("SITE_URL") || "https://www.thepuffletteco.cc";

// Brand palette (Cream & Cocoa)
const CARAMEL = "#C89B6A", COCOA = "#6B4A32", DARK = "#1C1613", CREAM = "#FBF6EE";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const naira = (kobo: number) => "₦" + Math.round((kobo || 0) / 100).toLocaleString("en-NG");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function itemsRows(items: any[]): string {
  return (Array.isArray(items) ? items : [])
    .map(
      (it) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eaddc9;"><strong style="color:${DARK};">${it.name}</strong> &times;${it.quantity ?? 1}${it.flavor ? `<br><span style="font-size:12px;color:${COCOA};font-weight:600;">Flavour: ${it.flavor}</span>` : ""}${it.note ? `<br><span style="font-size:12px;color:#8a7c6f;font-style:italic;">“${it.note}”</span>` : ""}</td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid #eaddc9;color:${COCOA};font-weight:600;white-space:nowrap;">${naira((it.price || 0) * (it.quantity ?? 1))}</td>
    </tr>`,
    )
    .join("");
}

// Utilitarian, information-dense alert for the shop owner.
function adminEmail(o: any): string {
  const fulfil =
    o.delivery_method === "pickup"
      ? "Pickup"
      : `Delivery${o.customer_city ? ` — ${o.customer_city}` : ""}`;
  const when = [o.required_date, o.required_time].filter(Boolean).join(" · ") || "—";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:${CREAM};font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:18px;overflow:hidden;max-width:600px;border:1px solid #eaddc9;">
        <tr><td style="background:${DARK};padding:28px 32px;">
          <div style="color:#fff;font-size:22px;font-family:Georgia,serif;">🔔 New order received</div>
          <div style="color:${CARAMEL};font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:6px;">thepufflette.co · Order ${o.order_number}</div>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${DARK};">
            <tr><td style="padding:6px 0;color:#8a7c6f;width:130px;">Customer</td><td style="padding:6px 0;font-weight:600;">${o.customer_name || "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#8a7c6f;">Phone</td><td style="padding:6px 0;font-weight:600;">${o.customer_phone || "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#8a7c6f;">Email</td><td style="padding:6px 0;">${o.customer_email || "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#8a7c6f;">Fulfilment</td><td style="padding:6px 0;font-weight:600;">${fulfil}</td></tr>
            ${o.customer_address ? `<tr><td style="padding:6px 0;color:#8a7c6f;">Address</td><td style="padding:6px 0;">${o.customer_address}</td></tr>` : ""}
            <tr><td style="padding:6px 0;color:#8a7c6f;">When</td><td style="padding:6px 0;font-weight:600;">${when}</td></tr>
            ${o.notes ? `<tr><td style="padding:6px 0;color:#8a7c6f;">Notes</td><td style="padding:6px 0;font-style:italic;">${o.notes}</td></tr>` : ""}
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;">${itemsRows(o.items)}</table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;font-size:14px;color:${DARK};">
            <tr><td style="padding:4px 0;color:#8a7c6f;">Subtotal</td><td align="right" style="padding:4px 0;">${naira(o.subtotal)}</td></tr>
            ${o.coupon_discount ? `<tr><td style="padding:4px 0;color:#8a7c6f;">Discount${o.coupon_code ? ` (${o.coupon_code})` : ""}</td><td align="right" style="padding:4px 0;color:${CARAMEL};">−${naira(o.coupon_discount)}</td></tr>` : ""}
            <tr><td style="padding:4px 0;color:#8a7c6f;">Delivery</td><td align="right" style="padding:4px 0;">${o.delivery_fee ? naira(o.delivery_fee) : "Free"}</td></tr>
            ${o.service_fee ? `<tr><td style="padding:4px 0;color:#8a7c6f;">Service fee</td><td align="right" style="padding:4px 0;">${naira(o.service_fee)}</td></tr>` : ""}
            <tr><td style="padding:10px 0 0;font-weight:700;border-top:1px solid #eaddc9;">Total paid</td><td align="right" style="padding:10px 0 0;font-weight:700;border-top:1px solid #eaddc9;color:${COCOA};font-size:18px;">${naira(o.total_price)}</td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Branded confirmation for the customer.
function customerEmail(o: any): string {
  const first = String(o.customer_name || "there").split(" ")[0];
  const info =
    o.delivery_method === "pickup"
      ? "We'll let you know as soon as it's ready to collect."
      : "Our team will be in touch to arrange your delivery.";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:${CREAM};font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;max-width:600px;border:1px solid #eaddc9;">
        <tr><td style="background:${CARAMEL};padding:36px;text-align:center;">
          <div style="color:#fff;font-size:28px;font-family:Georgia,serif;font-style:italic;">thepufflette.co</div>
          <div style="color:#fff;opacity:.85;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-top:6px;">Order Confirmed</div>
        </td></tr>
        <tr><td style="padding:36px;">
          <p style="font-size:20px;color:${DARK};margin:0 0 6px;">Thank you, ${first}! 🎉</p>
          <p style="font-size:14px;color:#6b5b53;margin:0 0 24px;line-height:1.6;">We've received your order and payment. ${info}</p>
          <div style="background:${CREAM};border-radius:12px;padding:16px 20px;margin-bottom:24px;">
            <span style="font-size:12px;color:#9b8f85;">Your order number:</span>
            <strong style="color:${COCOA};letter-spacing:1px;"> ${o.order_number}</strong>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">${itemsRows(o.items)}</table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:14px;">
            <tr><td style="padding-top:10px;font-weight:700;border-top:1px solid #eaddc9;color:${DARK};">Total</td><td align="right" style="padding-top:10px;font-weight:700;border-top:1px solid #eaddc9;color:${COCOA};font-size:18px;">${naira(o.total_price)}</td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin:28px auto 0;"><tr><td style="border-radius:999px;background:${CARAMEL};">
            <a href="${SITE_URL}/order-success?order=${encodeURIComponent(o.order_number)}" style="display:inline-block;padding:14px 34px;color:#ffffff;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;text-decoration:none;border-radius:999px;">View your order</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:${DARK};padding:24px;text-align:center;">
          <div style="color:#fff;font-family:Georgia,serif;font-style:italic;font-size:18px;">thepufflette.co</div>
          <div style="color:#9b8f85;font-size:11px;margin-top:4px;">Made fresh, made with love</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendEmail(to: string, subject: string, html: string, replyTo?: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Resend error:", JSON.stringify(body));
    return { ok: false, error: body?.message || `HTTP ${res.status}` };
  }
  return { ok: true, id: body?.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "bad JSON" }, 400);
  }
  const orderNumber: string | undefined = payload.order_number;
  if (!orderNumber) return json({ ok: false, error: "order_number required" }, 400);

  if (!RESEND_API_KEY) {
    // Not a failure — the shop just hasn't connected email yet. Never break checkout.
    return json({ ok: false, reason: "email-not-configured" });
  }

  // Authoritative order details from the DB (service role), falling back to the
  // caller payload if the row isn't visible yet.
  const { data: dbOrder } = await supabase
    .from("diamond_orders")
    .select(
      "order_number, customer_name, customer_email, customer_phone, customer_address, customer_city, delivery_method, delivery_fee, service_fee, required_date, required_time, items, subtotal, coupon_code, coupon_discount, total_price, notes",
    )
    .eq("order_number", orderNumber)
    .maybeSingle();

  const o = dbOrder || {
    order_number: orderNumber,
    customer_name: payload.name,
    customer_email: payload.email,
    customer_phone: payload.phone,
    delivery_method: payload.method,
    delivery_fee: payload.delivery_fee,
    required_date: payload.required_date,
    required_time: payload.required_time,
    items: payload.items,
    subtotal: payload.subtotal,
    coupon_discount: payload.discount,
    total_price: payload.total,
  };

  // Resolve the admin recipient: shop contact email → SHOP_ADMIN_EMAIL secret.
  const { data: settings } = await supabase
    .from("diamond_site_settings")
    .select("contact_email")
    .limit(1)
    .maybeSingle();
  // Lowercase the recipient: email addresses are case-insensitive, but Resend's
  // free-tier "own address only" check is case-sensitive, so "Thepuffletteco@…"
  // would be rejected against the registered "thepuffletteco@…".
  const adminTo = (settings?.contact_email || SHOP_ADMIN_EMAIL || "").trim().toLowerCase();

  const results: Record<string, unknown> = {};

  // 1) Admin alert (the important one). Reply-To set to the customer so the
  //    owner can just hit reply.
  if (adminTo) {
    const subject = `🔔 New order ${o.order_number} — ${naira(o.total_price)}`;
    const r = await sendEmail(adminTo, subject, adminEmail(o), o.customer_email || undefined);
    results.admin = r;
    if (r.ok) {
      await supabase
        .from("diamond_email_log")
        .insert({ email: adminTo, subject, type: "new_order_admin", resend_id: (r as any).id })
        .then(() => {}, () => {});
    }
  } else {
    results.admin = { ok: false, reason: "no-admin-email" };
  }

  // 2) Customer confirmation (best-effort; needs a verified sending domain to
  //    reach arbitrary inboxes — until then Resend only allows the account's
  //    own address, so this is expected to no-op for real customers).
  const customerTo = (o.customer_email || "").trim().toLowerCase();
  if (customerTo) {
    const subject = `Order ${o.order_number} confirmed — thepufflette.co`;
    const r = await sendEmail(customerTo, subject, customerEmail(o));
    results.customer = r;
    if (r.ok) {
      await supabase
        .from("diamond_email_log")
        .insert({ email: o.customer_email, subject, type: "order_confirmation", resend_id: (r as any).id })
        .then(() => {}, () => {});
    }
  }

  const ok = (results.admin as any)?.ok === true || (results.customer as any)?.ok === true;
  return json({ ok, results });
});
