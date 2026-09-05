// thepufflette.co — admin broadcast / marketing email.
//
// Called from the admin Marketing page. Verifies the caller is a thepufflette.co
// admin (their Supabase access token + diamond_admins allowlist), renders a
// branded thepufflette.co email (heading, body paragraphs, optional CTA button) and
// sends it — either as a test to one address or to every customer with an email.
// Sends are personalised per recipient and one-per-message (Resend batch), so
// customers never see each other's addresses.
//
// Secrets: DT_RESEND_API_KEY (falls back to RESEND_API_KEY), DT_FROM_EMAIL,
//   and auto-injected SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("DT_RESEND_API_KEY") || Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("DT_FROM_EMAIL") || "thepufflette.co <orders@thepuffletteco.cc>";

const PINK = "#EC008C", PLUM = "#8B3A62", DARK = "#2B1722";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function unsubUrl(email: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(email.toLowerCase()));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${SUPABASE_URL}/functions/v1/diamond-unsubscribe?e=${b64url(email.toLowerCase())}.${hex}`;
}

function inlineImg(url: string): string {
  return `<img src="${esc(url)}" alt="" style="display:block;width:100%;max-width:528px;height:auto;border:0;border-radius:14px;margin:14px 0;" />`;
}
function emailHtml(o: { heading: string; body: string; buttonLabel?: string; buttonUrl?: string; firstName?: string; imageUrl?: string; unsub?: string }): string {
  const greeting = o.firstName ? `Hi ${esc(o.firstName)},` : "Hi there,";
  // Image goes inline at the {image} marker; if there's no marker, fall back to the top.
  const hasMarker = /\{image\}/.test(o.body);
  const image = o.imageUrl && !hasMarker
    ? `<img src="${esc(o.imageUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />`
    : "";
  const paragraphs = o.body
    .split(/\n{1,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p === "{image}"
      ? (o.imageUrl ? inlineImg(o.imageUrl) : "")
      : `<p style="font-size:15px;color:#4b3b43;line-height:1.7;margin:0 0 16px;">${esc(p)}</p>`)
    .join("");
  const button = o.buttonLabel && o.buttonUrl
    ? `<table cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr><td style="border-radius:999px;background:${PINK};">
         <a href="${esc(o.buttonUrl)}" style="display:inline-block;padding:14px 34px;color:#ffffff;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;text-decoration:none;border-radius:999px;">${esc(o.buttonLabel)}</a>
       </td></tr></table>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FFF6FB;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF6FB;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;max-width:600px;">
        <tr><td style="background:${PINK};padding:34px;text-align:center;">
          <div style="color:#fff;font-size:30px;font-family:Georgia,serif;font-style:italic;">thepufflette.co</div>
        </td></tr>
        ${image ? `<tr><td>${image}</td></tr>` : ""}
        <tr><td style="padding:38px 36px;">
          <h1 style="font-size:24px;color:${DARK};margin:0 0 18px;font-family:Georgia,serif;">${esc(o.heading)}</h1>
          <p style="font-size:15px;color:#4b3b43;line-height:1.7;margin:0 0 16px;">${greeting}</p>
          ${paragraphs}
          ${button}
        </td></tr>
        <tr><td style="background:${DARK};padding:24px;text-align:center;">
          <div style="color:#fff;font-family:Georgia,serif;font-style:italic;font-size:18px;">thepufflette.co</div>
          <div style="color:#9b8f95;font-size:11px;margin-top:6px;">You're a thepufflette.co customer.${o.unsub ? ` <a href="${esc(o.unsub)}" style="color:#9b8f95;text-decoration:underline;">Unsubscribe</a>` : ""}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  // Auth: must be a signed-in thepufflette.co admin.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "Unauthorized" }, 401);
  const { data: ures } = await admin.auth.getUser(token);
  if (!ures?.user) return json({ ok: false, error: "Unauthorized" }, 401);
  const { data: isAdmin } = await admin.from("diamond_admins").select("id").eq("id", ures.user.id).maybeSingle();
  if (!isAdmin) return json({ ok: false, error: "Forbidden" }, 403);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ ok: false, error: "Bad JSON" }, 400); }
  const { subject, heading, body, buttonLabel, buttonUrl, imageUrl, test, testEmail, segment } = payload || {};
  if (!subject?.trim() || !heading?.trim() || !body?.trim()) {
    return json({ ok: false, error: "Subject, heading and body are required." }, 400);
  }

  type Recipient = { email: string; name: string | null; product?: string | null };

  // Build the recipient list, optionally narrowed to a behavioural segment.
  let recipients: Recipient[] = [];
  if (test) {
    const to = (testEmail || ures.user.email || "").trim();
    if (!to) return json({ ok: false, error: "No test email address." }, 400);
    recipients = [{ email: to, name: null, product: null }];
  } else {
    let q = admin
      .from("diamond_customers")
      .select("email, full_name, last_added_product_name, last_viewed_product_name")
      .not("email", "is", null);
    const PIPELINE = ["lead", "new", "repeat", "vip", "at_risk", "lapsed"];
    if (PIPELINE.includes(segment)) q = q.eq("lifecycle_stage", segment);
    else if (segment === "checkout") q = q.not("last_checkout_at", "is", null);
    else if (segment === "cart") q = q.not("last_added_at", "is", null);
    else if (segment === "viewed") q = q.not("last_viewed_at", "is", null);
    const { data } = await q;
    const seen = new Set<string>();
    for (const r of data || []) {
      const e = (r.email || "").trim();
      const key = e.toLowerCase();
      if (e && !seen.has(key)) {
        seen.add(key);
        recipients.push({ email: e, name: r.full_name, product: r.last_added_product_name || r.last_viewed_product_name });
      }
    }
  }

  // Drop anyone who has unsubscribed (test sends still go through).
  if (!test) {
    const { data: unsubs } = await admin.from("diamond_email_unsubscribes").select("email");
    const suppressed = new Set((unsubs || []).map((u) => (u.email || "").toLowerCase()));
    recipients = recipients.filter((r) => !suppressed.has(r.email.toLowerCase()));
  }
  if (!recipients.length) return json({ ok: true, sent: 0, failed: 0, total: 0 });

  // Replace {first_name} and {product} tokens per recipient.
  const fill = (s: string | undefined, r: Recipient): string =>
    (s || "")
      .replace(/\{first_name\}/gi, (r.name || "").split(" ")[0] || "there")
      .replace(/\{product\}/gi, r.product || "your order");

  let sent = 0, failed = 0;
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    const batch = await Promise.all(chunk.map(async (r) => ({
      from: FROM_EMAIL,
      to: [r.email],
      subject: fill(subject, r),
      html: emailHtml({
        heading: fill(heading, r),
        body: fill(body, r),
        buttonLabel: buttonLabel ? fill(buttonLabel, r) : buttonLabel,
        buttonUrl: buttonUrl ? fill(buttonUrl, r) : buttonUrl,
        imageUrl,
        firstName: (r.name || "").split(" ")[0],
        unsub: await unsubUrl(r.email),
      }),
    })));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (res.ok) {
        sent += chunk.length;
        // Capture per-recipient Resend ids (batch returns data[] in input order) so broadcast
        // opens/clicks can be tracked via diamond_email_events, then log one row each.
        const out = await res.json().catch(() => ({} as any));
        const ids: string[] = Array.isArray(out?.data) ? out.data.map((x: any) => x?.id) : [];
        await admin.from("diamond_email_log").insert(
          chunk.map((r, j) => ({ email: r.email, subject: fill(subject, r), type: test ? "manual" : "broadcast", resend_id: ids[j] || null }))
        );
      }
      else { failed += chunk.length; console.error("[DT BROADCAST] batch failed:", await res.text()); }
    } catch (e) { failed += chunk.length; console.error("[DT BROADCAST]", e); }
  }
  return json({ ok: failed === 0, sent, failed, total: recipients.length });
});
