// Diamond Taste — Resend webhook ingester.
// Receives email.delivered / opened / clicked / bounced / complained events from Resend
// and stores them in diamond_email_events (joined to diamond_email_sends by resend_id).
// Verifies the Svix signature when DT_RESEND_WEBHOOK_SECRET is set. verify_jwt is OFF.
//
// Setup: in Resend > Webhooks add this URL, enable open+click tracking, copy the signing
// secret into the DT_RESEND_WEBHOOK_SECRET edge-function secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SECRET = Deno.env.get("DT_RESEND_WEBHOOK_SECRET") || Deno.env.get("RESEND_WEBHOOK_SECRET") || "";

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function verify(payload: string, headers: Headers): Promise<boolean> {
  if (!SECRET) return true; // not configured yet — accept (logged)
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature") || "";
  if (!id || !ts || !sigHeader) return false;
  const secretBytes = b64decode(SECRET.startsWith("whsec_") ? SECRET.slice(6) : SECRET);
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = `${id}.${ts}.${payload}`;
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  const expected = b64encode(mac);
  return sigHeader.split(" ").some((part) => part.split(",")[1] === expected);
}

Deno.serve(async (req) => {
  if (req.method === "GET") return new Response("Diamond Taste Resend webhook is ACTIVE.", { status: 200 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  if (!(await verify(raw, req.headers))) {
    if (SECRET) return new Response("bad signature", { status: 401 });
    console.warn("[DT WEBHOOK] DT_RESEND_WEBHOOK_SECRET not set — accepting unverified");
  }

  let evt: any;
  try { evt = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

  const type = String(evt?.type || "").replace(/^email\./, "");
  const data = evt?.data || {};
  const resendId = data.email_id || data.id || null;
  const to = Array.isArray(data.to) ? data.to[0] : data.to || null;
  const url = data?.click?.link || null;
  const occurredAt = evt?.created_at || data?.click?.timestamp || new Date().toISOString();
  if (!type || !resendId) return new Response("ignored", { status: 200 });

  const { error } = await admin.from("diamond_email_events").insert({
    resend_id: resendId, email: to, type, url, occurred_at: occurredAt,
  });
  if (error && !String(error.message).includes("duplicate")) console.error("[DT WEBHOOK]", error.message);

  if (to && (type === "bounced" || type === "complained")) {
    await admin.from("diamond_email_unsubscribes").upsert({ email: to.toLowerCase() }, { onConflict: "email" });
  }
  return new Response("ok", { status: 200 });
});