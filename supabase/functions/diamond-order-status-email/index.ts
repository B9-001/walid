// Diamond Taste — Order status update email.
//
// Fired by a DB trigger on diamond_orders whenever `status` changes (so it covers
// website AND chatbot orders, however the status is updated). Receives just the
// order_number + new status, looks the order up with the service role (so the
// emailed details are authoritative, not caller-supplied), and emails the customer
// a branded "your order is now …" update.
//
// Secrets: DT_RESEND_API_KEY (falls back to RESEND_API_KEY), DT_FROM_EMAIL,
//   and auto-injected SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("DT_RESEND_API_KEY") || Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("DT_FROM_EMAIL") || "Diamond Taste <onboarding@resend.dev>";

const PINK = "#EC008C", PLUM = "#8B3A62", DARK = "#2B1722";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const naira = (kobo: number) => "₦" + Math.round(kobo / 100).toLocaleString("en-NG");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Method-aware copy, mirroring the website's order tracker.
function statusCopy(status: string, method: string): { title: string; line: string } | null {
  const isPickup = method === "pickup";
  switch (status) {
    case "confirmed": return { title: "Your order is confirmed 🎉", line: "We've confirmed your order and will start baking soon." };
    case "baking":    return { title: "We're baking your order 👩‍🍳", line: "Your order is being freshly prepared right now." };
    case "ready":     return isPickup
      ? { title: "Your order is ready for pickup 📦", line: "Your order is ready! Come collect it at your convenience." }
      : { title: "Your order is out for delivery 🚚", line: "Your order is on its way — our team will be in touch about your delivery." };
    case "completed": return isPickup
      ? { title: "Order picked up — enjoy! 🎂", line: "Thank you for collecting your order. We hope you love it!" }
      : { title: "Order delivered — enjoy! 🎂", line: "Your order has been delivered. We hope you love it!" };
    case "cancelled": return { title: "Your order has been cancelled", line: "Your order has been cancelled. If this is a mistake or you have questions, just reply to this email." };
    default: return null; // pending / unknown → no email
  }
}

function itemsRows(items: any[]): string {
  return (Array.isArray(items) ? items : []).map((it) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0e0ea;"><strong style="color:${DARK};">${it.name}</strong> &times;${it.quantity ?? 1}</td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid #f0e0ea;color:${PLUM};font-weight:600;white-space:nowrap;">${naira((it.price || 0) * (it.quantity ?? 1))}</td>
    </tr>`).join("");
}

function statusEmail(order: any, copy: { title: string; line: string }): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FFF6FB;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF6FB;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;max-width:600px;">
        <tr><td style="background:${PINK};padding:36px;text-align:center;">
          <div style="color:#fff;font-size:30px;font-family:Georgia,serif;font-style:italic;">Diamond Taste</div>
          <div style="color:#ffd6ee;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-top:6px;">Order Update</div>
        </td></tr>
        <tr><td style="padding:36px;">
          <p style="font-size:20px;color:${DARK};margin:0 0 6px;">${copy.title}</p>
          <p style="font-size:14px;color:#6b5b63;margin:0 0 24px;line-height:1.6;">Hi ${String(order.customer_name || "there").split(" ")[0]}, ${copy.line}</p>
          <div style="background:#FFF6FB;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
            <span style="font-size:12px;color:#9b8f95;">Order ref:</span>
            <strong style="color:${PINK};letter-spacing:1px;"> ${order.order_number}</strong>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">${itemsRows(order.items)}</table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:14px;">
            <tr><td style="padding-top:10px;font-weight:700;border-top:1px solid #f0e0ea;color:${DARK};">Total</td><td align="right" style="padding-top:10px;font-weight:700;border-top:1px solid #f0e0ea;color:${PINK};font-size:18px;">${naira(order.total_price || 0)}</td></tr>
          </table>
        </td></tr>
        <tr><td style="background:${DARK};padding:24px;text-align:center;">
          <div style="color:#fff;font-family:Georgia,serif;font-style:italic;font-size:18px;">Diamond Taste</div>
          <div style="color:#9b8f95;font-size:11px;margin-top:4px;">Baked fresh, made with love</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { order_number, status } = await req.json();
    if (!order_number || !status) return json({ ok: false, error: "order_number and status required" }, 400);

    const { data: order } = await supabase.from("diamond_orders")
      .select("order_number, customer_name, customer_email, delivery_method, items, total_price, status")
      .eq("order_number", order_number).maybeSingle();
    if (!order) return json({ ok: false, error: "order not found" }, 404);

    const copy = statusCopy(status, order.delivery_method || "delivery");
    if (!copy) return json({ ok: true, skipped: `no email for status '${status}'` });
    if (!order.customer_email) return json({ ok: true, skipped: "no customer email on order" });

    const subject = `Order ${order.order_number} — ${copy.title}`;
    const result = await sendEmail(order.customer_email, subject, statusEmail(order, copy));
    if (result.ok) {
      await supabase.from("diamond_email_log").insert({ email: order.customer_email, subject, type: "order_status", resend_id: (result as any).id });
    }
    return json({ ok: result.ok, ...result });
  } catch (err) {
    return json({ ok: false, error: String(err) }, 400);
  }
});

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { console.error("Resend error:", JSON.stringify(body)); return { ok: false, error: body?.message || `HTTP ${res.status}` }; }
  return { ok: true, id: body?.id };
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
