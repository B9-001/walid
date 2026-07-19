// Central Paystack webhook for the SHARED Paystack account.
// Paystack only allows ONE webhook URL per account, and Diamond Taste + Bedz n
// Buttunz share one account (separated by subaccount). This dispatcher receives
// every charge.success, decides which store it belongs to (by subaccount code or
// reference prefix), and FORWARDS the untouched raw body + x-paystack-signature
// to that store's own webhook function, which re-verifies the HMAC and processes
// it exactly as before. It does NOT process orders itself, so each store's logic
// stays independent. Anything not clearly Bedz defaults to Diamond (preserving
// Diamond's catch-all, incl. Instagram-bot orders). Add new stores by extending
// ROUTES. verify_jwt = false (Paystack can't send a Supabase JWT; the downstream
// webhooks are the security gate via signature verification).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// Each route: if match(subaccountCode, reference) -> forward to this store's webhook.
// `fn` = a function ON THIS PROJECT; `url` = an absolute URL (for stores whose webhook
// lives on a DIFFERENT Supabase project, e.g. Vanilla Salt on the Ukshopper project).
const ROUTES: { store: string; fn?: string; url?: string; match: (sub: string, ref: string) => boolean }[] = [
  {
    store: "bedznbuttunz",
    fn: "bnb-paystack-webhook",
    match: (sub, ref) => sub === "ACCT_nsv8ge29oipkar7" || ref.toLowerCase().startsWith("bnb"),
  },
  {
    store: "vanillasalt",
    url: "https://kmfxpeeddtxozbznetzj.supabase.co/functions/v1/vanillasalt-paystack-webhook",
    match: (sub) => sub === "ACCT_cw3ahgoxv5bleco",
  },
  {
    store: "amees",
    fn: "amees-paystack-webhook",
    match: (sub) => sub === "ACCT_e4db9q36sn1ao7v",
  },
  {
    store: "samyz",
    url: "https://kmfxpeeddtxozbznetzj.supabase.co/functions/v1/sultyz-paystack-webhook",
    match: (sub, ref) => sub === "ACCT_jxfe5v6m1wvh0va" || ref.toUpperCase().startsWith("SZPAY"),
  },
  // Future stores on this account go here, before the default.
];
const DEFAULT_FN = "diamond-paystack-webhook"; // catch-all: Diamond website + IG orders

Deno.serve(async (req: Request) => {
  if (req.method === "GET") return new Response("Central Paystack webhook is ACTIVE.", { status: 200 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.text();
  const signature = req.headers.get("x-paystack-signature") || "";

  // Parse only to read routing fields (subaccount + reference). The downstream
  // webhook re-verifies the signature over this exact body, so a forged/junk body
  // simply fails verification there.
  let data: any = {};
  try { data = (JSON.parse(body) || {}).data || {}; } catch { /* leave empty -> default route */ }
  const sub = (typeof data.subaccount === "string" ? data.subaccount : data.subaccount?.subaccount_code) || "";
  const ref = String(data.reference || "");

  // Resolve the forward target: a matched route's absolute url or same-project fn,
  // otherwise the Diamond catch-all.
  let targetUrl = `${SUPABASE_URL}/functions/v1/${DEFAULT_FN}`;
  let targetName = DEFAULT_FN;
  for (const r of ROUTES) {
    if (r.match(sub, ref)) {
      targetUrl = r.url ?? `${SUPABASE_URL}/functions/v1/${r.fn}`;
      targetName = r.store;
      break;
    }
  }

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-paystack-signature": signature },
      body,
    });
    console.log(`[CENTRAL] ref=${ref} sub=${sub} -> ${targetName} (${res.status})`);
  } catch (e) {
    console.error("[CENTRAL] forward error (non-fatal):", e);
  }
  // Always 200 so Paystack never retries against the dispatcher itself.
  return new Response(JSON.stringify({ routed: true, target: targetName }), { status: 200, headers: { "Content-Type": "application/json" } });
});
