// Diamond admin CRM email dashboard data: pipeline + tiers (DB), the AI broadcast queue
// (diamond_ai_broadcasts: scheduled to send incl. full body + reasoning, sent + stats, added today),
// the per-tier AI PLAYBOOK (diamond_ai_learnings: what the AI has learned), automation flows, and
// recent email activity. Admin-gated via diamond_admins. Also returns a back-compat `broadcasts` array.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KEY = Deno.env.get("DT_RESEND_API_KEY") || Deno.env.get("RESEND_API_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const RH = { Authorization: `Bearer ${KEY}` };
const TIER_NAME: Record<string, string> = { "1": "Tier 1 · 0-1 orders", "2": "Tier 2 · 2-3 orders", "3": "Tier 3 · 4+ orders" };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const rget = async (path: string) => { try { return await (await fetch(`https://api.resend.com/${path}`, { headers: RH })).json(); } catch { return {}; } };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "unauthorized" }, 401);
  const { data: isAdmin } = await admin.from("diamond_admins").select("id").eq("id", u.user.id).maybeSingle();
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  const { data: custs } = await admin.from("diamond_customers").select("lifecycle_stage, resend_tier").not("email", "is", null);
  const pipeline: Record<string, number> = {}; const tiers: Record<string, number> = {};
  for (const c of custs || []) { const s = c.lifecycle_stage || "none"; pipeline[s] = (pipeline[s] || 0) + 1; const t = String(c.resend_tier || 1); tiers[t] = (tiers[t] || 0) + 1; }

  const elist = ((await rget("emails?limit=60")).data || []).map((e: any) => ({ to: (e.to || [])[0] || "", subject: e.subject, event: e.last_event, at: e.created_at }));
  const counts: Record<string, number> = {};
  for (const e of elist) counts[e.event || "sent"] = (counts[e.event || "sent"] || 0) + 1;
  const alist = ((await rget("automations")).data || []).filter((a: any) => String(a.name || "").startsWith("dt:")).map((a: any) => ({ name: a.name.replace("dt:", ""), status: a.status }));

  // AI broadcast queue with FULL email content + the AI's logged reasoning. send_at = when it sends/sent.
  const { data: ai } = await admin.from("diamond_ai_broadcasts")
    .select("tier, subject, body, angle, reasoning, image, cta_label, cta_url, sent_at, created_at, scored, recipients, delivered, opened, clicked")
    .order("sent_at", { ascending: false }).limit(60);
  // The compact per-tier playbook the AI maintains (what it has learned).
  const { data: learnings } = await admin.from("diamond_ai_learnings").select("tier, playbook, emails_learned, updated_at").order("tier");

  const nowIso = new Date().toISOString();
  // Back-compat shape for older dashboards that read `broadcasts`.
  const broadcasts = (ai || []).map((b: any) => ({ name: b.tier, tier: b.tier, subject: b.subject, status: b.sent_at > nowIso ? "scheduled" : "sent", scheduled_at: b.sent_at > nowIso ? b.sent_at : null, sent_at: b.sent_at <= nowIso ? b.sent_at : null }));

  return json({ pipeline, tiers, tierNames: TIER_NAME, recent: elist, recentCounts: counts, automations: alist, ai: ai || [], learnings: learnings || [], broadcasts, now: nowIso, generated_at: nowIso });
});
