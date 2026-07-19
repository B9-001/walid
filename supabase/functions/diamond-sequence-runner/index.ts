// Diamond Taste — sequence runner.
//
// Cron (hourly). For every ACTIVE sequence step, finds the customers currently in that
// audience whose "send after" time has elapsed, and sends the email — ONCE PER PERSON,
// EVER. Dedupe is keyed on (email, step). A step only enrolls customers who entered the
// stage/tag after it was activated (activated_at). Skips unsubscribes.
//
// EMAILS ARE PLAIN-TEXT PERSONAL STYLE: no banner/card/button, so they land in the Primary
// inbox. One optional inline image (curated per step via image_url, OR the customer's own
// viewed/added product for behaviour flows). CTA links are tagged ?source=emailmarketing&em=<send_id>.
//
// RELIABILITY: failed sends auto-retry (no diamond_email_sends row written); on a Resend
// rate/quota LIMIT we pause (diamond_email_send_state) — plain rate limit waits for the next
// hourly run, a daily quota waits until tomorrow morning; DAILY_CAP reserves headroom for
// transactional order emails; genuine errors are capped at MAX_ATTEMPTS via diamond_email_send_failures.
//
// Secrets: DT_RESEND_API_KEY (or RESEND_API_KEY), DT_FROM_EMAIL, auto SUPABASE_*.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("DT_RESEND_API_KEY") || Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("DT_FROM_EMAIL") || "Diamond Taste <onboarding@resend.dev>";
const REPLY_TO = FROM_EMAIL.match(/<(.+)>/)?.[1] || FROM_EMAIL;
const WEBSITE = "https://yourdomain.com";
const LINK = "#EC008C";
const PIPELINE = ["lead", "new", "repeat", "vip", "at_risk", "lapsed"];
const MAX_PER_RUN = 200;
const MAX_ATTEMPTS = 5;
const DAILY_CAP = 150; // reserve headroom in the shared Resend quota for order emails

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const absUrl = (u: string) => (!u ? "" : u.startsWith("http") ? u : `${WEBSITE}${u.startsWith("/") ? "" : "/"}${u}`);
const withTracking = (u: string, sendId: string) => {
  if (!u) return u;
  let out = /[?&]source=/.test(u) ? u : `${u}${u.includes("?") ? "&" : "?"}source=emailmarketing`;
  out += `${out.includes("?") ? "&" : "?"}em=${sendId}`;
  return out;
};

function isLimit(status: number, data: unknown): boolean {
  if (status === 429) return true;
  const msg = JSON.stringify(data || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("quota") || msg.includes("too many") ||
         msg.includes("daily limit") || msg.includes("monthly limit") || msg.includes("exceeded");
}
function resumeAfterLimit(data: unknown): Date {
  const msg = JSON.stringify(data || "").toLowerCase();
  const daily = msg.includes("daily") || msg.includes("month") || msg.includes("quota") || msg.includes("plan");
  if (!daily) return new Date(Date.now() + 30 * 60_000);
  const d = new Date(Date.now() + 24 * 3600_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 7, 0, 0));
}

function bumpToTime(due: Date, hhmm: string): Date {
  const [H, M] = hhmm.split(":").map(Number);
  const wat = new Date(due.getTime() + 3600_000);
  const target = new Date(Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), wat.getUTCDate(), H, M, 0));
  if (target.getTime() < wat.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return new Date(target.getTime() - 3600_000);
}

function fill(s: string | null, name: string, product: string): string {
  return (s || "").replace(/\{first_name\}/gi, name || "there").replace(/\{product\}/gi, product || "your order");
}

function b64url(s: string) { return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function unsubUrl(email: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(email.toLowerCase()));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${SUPABASE_URL}/functions/v1/diamond-unsubscribe?e=${b64url(email.toLowerCase())}.${hex}`;
}

function paragraphs(body: string): string[] {
  return body.split(/\n{1,}/).map((p) => p.trim()).filter((p) => p && p !== "{image}");
}

type EmailParts = { body: string; ctaLabel?: string | null; ctaUrl?: string | null; imageUrl?: string | null; firstName?: string; unsub: string };

function emailHtml(o: EmailParts): string {
  const greeting = o.firstName ? `Hi ${esc(o.firstName)},` : "Hi there,";
  const image = o.imageUrl
    ? `<p style="margin:0 0 20px;">${o.ctaUrl ? `<a href="${esc(o.ctaUrl)}">` : ""}<img src="${esc(o.imageUrl)}" width="556" alt="" style="display:block;width:100%;max-width:556px;height:auto;border:0;border-radius:10px;" />${o.ctaUrl ? "</a>" : ""}</p>`
    : "";
  const paras = paragraphs(o.body).map((p) => `<p style="margin:0 0 18px;">${esc(p)}</p>`).join("");
  const cta = o.ctaLabel && o.ctaUrl
    ? `<p style="margin:0 0 18px;"><a href="${esc(o.ctaUrl)}" style="color:${LINK};text-decoration:underline;">${esc(o.ctaLabel)} &rarr;</a></p>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;">
  <div style="max-width:600px;margin:0 auto;padding:26px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.65;color:#222222;">
    <p style="margin:0 0 18px;">${greeting}</p>
    ${image}${paras}${cta}
    <p style="margin:26px 0 0;font-size:13px;color:#888888;">If you'd rather not hear from us, you can <a href="${esc(o.unsub)}" style="color:#888888;">unsubscribe here</a>.</p>
  </div>
</body></html>`;
}

function emailText(o: EmailParts): string {
  const greeting = o.firstName ? `Hi ${o.firstName},` : "Hi there,";
  const paras = paragraphs(o.body).join("\n\n");
  const cta = o.ctaLabel && o.ctaUrl ? `\n\n${o.ctaLabel}: ${o.ctaUrl}` : "";
  return `${greeting}\n\n${paras}${cta}\n\nIf you'd rather not hear from us, unsubscribe: ${o.unsub}`;
}

const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

// A customer's CURRENT action = most recent of viewed/cart/checkout (tie-break to the later
// funnel step). Keeps the behaviour audiences mutually exclusive.
function currentAction(c: any): string | null {
  const v = c.last_viewed_at ? new Date(c.last_viewed_at).getTime() : -1;
  const a = c.last_added_at ? new Date(c.last_added_at).getTime() : -1;
  const k = c.last_checkout_at ? new Date(c.last_checkout_at).getTime() : -1;
  const max = Math.max(v, a, k);
  if (max < 0) return null;
  if (k === max) return "checkout";
  if (a === max) return "cart";
  return "viewed";
}

async function membersFor(aud: string) {
  let q = admin.from("diamond_customers")
    .select("id, email, full_name, last_added_product_name, last_viewed_product_name, last_added_product_id, last_viewed_product_id, stage_changed_at, created_at, last_checkout_at, last_added_at, last_viewed_at")
    .not("email", "is", null);
  if (PIPELINE.includes(aud)) q = q.eq("lifecycle_stage", aud);
  else if (aud === "checkout") q = q.not("last_checkout_at", "is", null);
  else if (aud === "cart") q = q.not("last_added_at", "is", null);
  else if (aud === "viewed") q = q.not("last_viewed_at", "is", null);
  let rows = (await q).data || [];
  if (aud === "checkout" || aud === "cart" || aud === "viewed") rows = rows.filter((c) => currentAction(c) === aud);
  return rows.map((c) => ({
    id: c.id, email: c.email as string, name: (c.full_name || "").split(" ")[0],
    product: c.last_added_product_name || c.last_viewed_product_name || "",
    productId: c.last_added_product_id || c.last_viewed_product_id || null,
    entered_at: PIPELINE.includes(aud) ? (c.stage_changed_at || c.created_at)
      : aud === "checkout" ? c.last_checkout_at
      : aud === "cart" ? c.last_added_at
      : aud === "viewed" ? c.last_viewed_at
      : c.created_at, // "all" anchors on signup (new-entrants only; never retroactively blasts the list)
  }));
}

Deno.serve(async (req) => {
  if (req.method === "GET") return new Response("Diamond Taste sequence runner is ACTIVE.", { status: 200 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { data: state } = await admin.from("diamond_email_send_state").select("paused_until").eq("id", 1).maybeSingle();
  if (state?.paused_until && Date.now() < new Date(state.paused_until).getTime()) {
    return json({ sent: 0, paused_until: state.paused_until });
  }

  const d = new Date();
  const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  const { count: sentToday } = await admin.from("diamond_email_sends").select("*", { count: "exact", head: true }).gte("sent_at", dayStart);
  const budget = DAILY_CAP - (sentToday || 0);
  if (budget <= 0) return json({ sent: 0, daily_cap: DAILY_CAP, sent_today: sentToday || 0 });

  const { data: steps } = await admin.from("diamond_sequence_steps").select("*").eq("active", true);
  if (!steps?.length) return json({ sent: 0, note: "no active steps" });

  const { data: unsubs } = await admin.from("diamond_email_unsubscribes").select("email");
  const suppressed = new Set((unsubs || []).map((u) => (u.email || "").toLowerCase()));

  const byAud: Record<string, any[]> = {};
  for (const s of steps) (byAud[s.audience] ||= []).push(s);

  const now = Date.now();
  const candidates: any[] = [];
  for (const [aud, audSteps] of Object.entries(byAud)) {
    const members = await membersFor(aud);
    for (const m of members) {
      if (!m.email || !m.entered_at || suppressed.has(m.email.toLowerCase())) continue;
      const anchorIso = new Date(m.entered_at).toISOString();
      const anchorMs = new Date(m.entered_at).getTime();
      for (const step of audSteps) {
        if (step.activated_at && anchorMs < new Date(step.activated_at).getTime()) continue;
        let due = anchorMs + (step.delay_hours || 0) * 3600_000;
        if (step.send_at_time) due = bumpToTime(new Date(due), step.send_at_time).getTime();
        if (now >= due) candidates.push({ m, step, anchorIso, due });
      }
    }
  }
  if (!candidates.length) return json({ sent: 0 });

  const stepIds = [...new Set(candidates.map((c) => c.step.id))];
  const { data: existing } = await admin.from("diamond_email_sends").select("email, step_id").in("step_id", stepIds);
  const done = new Set((existing || []).map((e) => `${(e.email || "").toLowerCase()}|${e.step_id}`));
  const { data: fails } = await admin.from("diamond_email_send_failures").select("email, step_id, attempts").in("step_id", stepIds);
  const exhausted = new Set((fails || []).filter((f) => (f.attempts || 0) >= MAX_ATTEMPTS).map((f) => `${(f.email || "").toLowerCase()}|${f.step_id}`));
  // ONE email per person per run, earliest-due first. Any other due steps wait for the next
  // hourly run — so a backlog of past-due steps can NEVER burst all at once.
  const eligible = candidates
    .filter((c) => { const k = `${(c.m.email || "").toLowerCase()}|${c.step.id}`; return !done.has(k) && !exhausted.has(k); })
    .sort((a, b) => a.due - b.due);
  const seenPerson = new Set<string>();
  const toSend: any[] = [];
  for (const c of eligible) {
    const e = (c.m.email || "").toLowerCase();
    if (seenPerson.has(e)) continue;
    seenPerson.add(e);
    toSend.push(c);
    if (toSend.length >= Math.min(MAX_PER_RUN, budget)) break;
  }

  const pids = [...new Set(toSend.map((c) => c.m.productId).filter(Boolean))];
  const prodImg: Record<string, string> = {};
  if (pids.length) {
    const { data: prods } = await admin.from("diamond_products").select("id, image_url").in("id", pids);
    for (const p of prods || []) if (p.image_url) prodImg[p.id] = p.image_url;
  }

  let sent = 0, failed = 0, limited = false;
  const sentThisRun = new Set<string>();
  for (const { m, step, anchorIso } of toSend) {
    const dedupeKey = `${(m.email || "").toLowerCase()}|${step.id}`;
    if (sentThisRun.has(dedupeKey)) continue;
    try {
      const sendId = crypto.randomUUID();
      const body = fill(step.body, m.name, m.product);
      const ctaLabel = step.button_label ? fill(step.button_label, m.name, m.product) : null;
      const ctaUrl = step.button_url ? withTracking(absUrl(fill(step.button_url, m.name, m.product)), sendId) : null;
      const imageUrl = step.image_url || (m.productId ? prodImg[m.productId] : null) || null;
      const unsub = await unsubUrl(m.email);
      const parts = { body, ctaLabel, ctaUrl, imageUrl, firstName: m.name, unsub };
      const subject = fill(step.subject, m.name, m.product);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM_EMAIL, reply_to: REPLY_TO, to: [m.email], subject, html: emailHtml(parts), text: emailText(parts) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (isLimit(res.status, data)) {
          const until = resumeAfterLimit(data);
          await admin.from("diamond_email_send_state").update({ paused_until: until.toISOString(), reason: `resend ${res.status}`, updated_at: new Date().toISOString() }).eq("id", 1);
          console.error("[DT RUNNER] limit hit, pausing until", until.toISOString(), JSON.stringify(data));
          limited = true;
          break;
        }
        failed++;
        await admin.rpc("diamond_record_email_failure", { p_email: m.email, p_step: step.id, p_status: res.status, p_error: JSON.stringify(data).slice(0, 400) });
        console.error("[DT RUNNER] resend", res.status, JSON.stringify(data));
        continue;
      }
      sent++;
      sentThisRun.add(dedupeKey);
      await admin.from("diamond_email_sends").insert({ id: sendId, customer_id: m.id, email: m.email, step_id: step.id, audience: step.audience, anchor_at: anchorIso, subject, resend_id: data.id });
      await admin.from("diamond_email_log").insert({ customer_id: m.id, email: m.email, subject, type: "sequence", resend_id: data.id });
    } catch (e) {
      failed++;
      await admin.rpc("diamond_record_email_failure", { p_email: m.email, p_step: step.id, p_status: 0, p_error: String(e).slice(0, 400) });
      console.error("[DT RUNNER]", e);
    }
  }
  return json({ sent, failed, limited, budget, eligible: toSend.length });
});