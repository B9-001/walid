// Diamond Taste — one-click email unsubscribe.
//
// Public. Links in marketing/sequence emails point here with a signed token
// (?e=<b64url(email)>.<hmac>). GET shows a confirm page; ?confirm=1 adds the email
// to diamond_email_unsubscribes so the runner + broadcasts skip them.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function unb64url(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(s + "=".repeat((4 - (s.length % 4)) % 4));
}
async function sign(email: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(email.toLowerCase()));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function verify(token: string): Promise<string | null> {
  const [e, sig] = (token || "").split(".");
  if (!e || !sig) return null;
  let email: string;
  try { email = unb64url(e); } catch { return null; }
  return (await sign(email)) === sig ? email : null;
}

function page(title: string, body: string): Response {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#FFF6FB;display:flex;min-height:100vh;align-items:center;justify-content:center;">
  <div style="background:#fff;border-radius:20px;padding:40px;max-width:440px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.06);">
    <div style="color:#EC008C;font-size:26px;font-family:Georgia,serif;font-style:italic;margin-bottom:18px;">Diamond Taste</div>
    ${body}
  </div>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const email = await verify(url.searchParams.get("e") || "");
  if (!email) return page("Invalid link", `<p style="color:#4b3b43;">This unsubscribe link is invalid or expired.</p>`);

  if (url.searchParams.get("confirm") === "1") {
    await admin.from("diamond_email_unsubscribes").upsert({ email: email.toLowerCase() }, { onConflict: "email" });
    return page("Unsubscribed", `<p style="font-size:16px;color:#2B1722;">You've been unsubscribed.</p><p style="font-size:13px;color:#6b5b63;margin-top:8px;">You won't get marketing emails from Diamond Taste anymore. Order confirmations will still be sent.</p>`);
  }

  const confirmUrl = `${url.origin}${url.pathname}?e=${encodeURIComponent(url.searchParams.get("e") || "")}&confirm=1`;
  return page("Unsubscribe", `
    <p style="font-size:16px;color:#2B1722;">Unsubscribe <strong>${email}</strong> from Diamond Taste marketing emails?</p>
    <a href="${confirmUrl}" style="display:inline-block;margin-top:20px;background:#EC008C;color:#fff;text-decoration:none;padding:13px 30px;border-radius:999px;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Yes, unsubscribe</a>`);
});
