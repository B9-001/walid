// Diamond Taste self-optimising AI broadcaster, APPEND-FOREVER queue + COMPACT PLAYBOOK + a HARD
// one-broadcast-per-AUDIENCE-per-day guard. Each run: (1) SCORE past broadcasts (>12h ago). (2) UPDATE
// each tier's playbook from only the newly-scored emails. (3) For each tier, schedule exactly ONE new
// broadcast on the next FREE future date. FREE = the tier's AUDIENCE has NO non-cancelled broadcast of
// ANY name (dtai:, anything) scheduled that day, read live from Resend by audience_id + date. So a
// customer can NEVER get two broadcasts in a day even across naming schemes or DB/Resend desync.
// ?dry=1 = plan only. ?mode=score = score+playbooks only. ?mode=reset = cancel+clear queued (verified).
// ?days=N = schedule N future days this run (max 14).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KEY = Deno.env.get("DT_RESEND_API_KEY") || Deno.env.get("RESEND_API_KEY")!;
const OR_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const OR_MODEL = Deno.env.get("OPENROUTER_MODEL") || "anthropic/claude-3.5-sonnet";
const FROM = "Diamond Taste <hello@yourdomain.com>";
const REPLY = "hello@yourdomain.com";
const SITE = "https://yourdomain.com";
const PBASE = "https://YOUR_SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/public/diamond-products/products/";
const IMAGES = ["bento5-main.jpg", "box12-main.jpg", "sheet-main.jpg", "bento2-main.jpg", "express8-main.jpg", "bento5-2-main.jpg", "box12-2-main.jpg", "sheet-2-main.jpg"];
const SEND_HOUR_UTC = 10;      // 11am WAT
const TIERS: { key: string; id: string; tn: number; goal: string }[] = [
  { key: "tier1", id: "04fb564c-79ef-4936-a54c-04fed4c6a23c", tn: 1, goal: "Warm people who signed up or ordered at most once. Turn appetite + trust into a FIRST (or second) order. Answer quiet doubts (is it fresh, how ordering works, delivery), make their mouth water, lower friction." },
  { key: "tier2", id: "f5170b29-f008-4730-a027-30a198113a0b", tn: 2, goal: "Repeat customers (2-3 orders). Keep them coming back: new flavours, occasions to order for, gentle loyalty. They already trust you." },
  { key: "tier3", id: "bfb1e42b-88a0-49d8-a02c-400fc46760ff", tn: 3, goal: "VIPs (4+ orders). Make them feel cherished and first-in-line. Warmth, exclusivity, personal touch over selling." },
];
const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function rf(method: string, path: string, body?: unknown, tries = 5): Promise<Response> {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`https://api.resend.com/${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    if (res.status !== 429) { await sleep(220); return res; }
    await sleep(900 + i * 600);
  }
  return fetch(`https://api.resend.com/${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
}
async function llm(system: string, user: string, temperature: number): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${OR_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: OR_MODEL, temperature, messages: [{ role: "system", content: system }, { role: "user", content: user }] }) });
  const d = await res.json();
  return (d?.choices?.[0]?.message?.content || "").trim();
}
function absUrl(u: string) { let url = (u || "/shop").startsWith("http") ? u : `${SITE}${u.startsWith("/") ? "" : "/"}${u}`; url += url.includes("?") ? "&source=emailmarketing" : "?source=emailmarketing"; return url; }
function buildHtml(body: string, cta: string, url: string, img: string): string {
  const link = absUrl(url);
  const image = `<p style=\"margin:0 0 20px;text-align:center;\"><a href=\"${esc(link)}\"><img src=\"${esc(PBASE + img)}\" width=\"300\" alt=\"Diamond Taste\" style=\"display:inline-block;width:100%;max-width:300px;height:auto;border:0;border-radius:12px;\" /></a></p>`;
  const ps = body.split(/\n{1,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p style=\"margin:0 0 16px;\">${esc(p).replace(/\{first_name\}/gi, "{{{FIRST_NAME|there}}}")}</p>`).join("");
  const c = cta ? `<p style=\"margin:0 0 16px;\"><a href=\"${esc(link)}\" style=\"color:#C026D3;\">${esc(cta)} &rarr;</a></p>` : "";
  return `<div style=\"max-width:600px;margin:0 auto;padding:24px 22px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#222;\"><p style=\"margin:0 0 16px;\">Hi {{{FIRST_NAME|there}}},</p>${image}${ps}${c}<p style=\"margin:24px 0 0;font-size:13px;color:#888;\"><a href=\"{{{RESEND_UNSUBSCRIBE_URL}}}\" style=\"color:#888;\">Unsubscribe</a></p></div>`;
}
const SYSTEM = `You are a world-class email copywriter for Diamond Taste, a fresh-baked cake brand in Abuja, Nigeria. Brand voice is Aisha: warm, personal, first-person, like a real woman who bakes and texts you, never corporate or salesy. Plain-text personal emails outperform polished designs.\n\nFacts you may use (never invent others): everything is baked fresh to order in Abuja and delivered across Abuja; the range includes soft milkcakes, creamy cake tubs, rich cheesecakes, bento cakes, cupcakes, sheet cakes and express cakes. No discounts unless told.\n\nProven rules: spend most effort on the SUBJECT (<=6 words, ~30-45 chars, punchy, curiosity or a tasty benefit, no emoji spam); hook in line one; 2-3 SHORT paragraphs; concrete sensory cake language; exactly ONE call to action; sign off as Aisha. Clicks matter more than opens. Be aware of the send date, the weekday and any Nigerian occasions/seasonality. Personalise the BODY greeting only with {first_name}; never put {first_name} or any variable in the subject.\n\nYou are given a PLAYBOOK: a short list of lessons you distilled from real results. Follow it, and write the new email as another experiment. Always state your theory for this email in \"reasoning\".\n\nReturn ONLY strict JSON, no fences: {\"subject\": string, \"body\": string (2-3 short paragraphs separated by blank lines, ending with a line that is just \"Aisha\"; may begin with a line using {first_name}), \"angle\": short technique label (a few words), \"reasoning\": string (2-3 sentences: your honest hypothesis for why THIS subject + angle will earn opens and especially CLICKS from THIS tier on THIS day, reacting to the playbook), \"cta_label\": short button text, \"cta_url\": \"/shop\" or \"/\"}`;
const PLAYBOOK_SYSTEM = `You maintain a concise, evolving PLAYBOOK of email tactics for ONE audience tier of a fresh-baked cake brand, learned from real send results. Keep it SHORT: at most 8 short bullet lines, <=120 words total. Each bullet is a concrete, reusable lesson: a tactic/angle/subject style that earned CLICKS (do more), or one that earned few/zero clicks (avoid). Merge the new results into the existing playbook, keep what still holds, drop stale or contradicted points, never let it grow beyond 8 bullets. Output ONLY the bullet list, no preamble, no headings.`;
async function generate(tier: { key: string; goal: string }, playbook: string, avoid: string[], sendDate: string, weekday: string): Promise<any> {
  const pb = playbook && playbook.trim() ? playbook.trim() : "(no playbook yet, the first emails for this tier; use best judgement)";
  const user = `Write the email for the ${tier.key} audience that will SEND on ${weekday}, ${sendDate}. Write it to feel right for THAT day.\nAudience goal: ${tier.goal}\n\nYour PLAYBOOK (lessons you distilled from real results, follow it):\n${pb}\n\nDo NOT reuse or closely echo these recent subjects: ${avoid.length ? avoid.map((s) => `\"${s}\"`).join(", ") : "(none)"}.\nReturn the JSON.`;
  const txt = (await llm(SYSTEM, user, 0.85)).replace(/```json/gi, "").replace(/```/g, "").trim();
  const m = txt.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null;
}
async function scorePast(): Promise<any[]> {
  const cutoff = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data: pend } = await admin.from("diamond_ai_broadcasts").select("*").eq("scored", false).lt("sent_at", cutoff).not("broadcast_id", "is", null);
  if (!pend?.length) return [];
  const emails = ((await (await rf("GET", "emails?limit=100")).json()).data) || [];
  const out: any[] = [];
  for (const b of pend) {
    const mine = emails.filter((e: any) => (e.subject || "") === b.subject);
    const delivered = mine.filter((e: any) => ["delivered", "opened", "clicked"].includes(e.last_event)).length;
    const opened = mine.filter((e: any) => ["opened", "clicked"].includes(e.last_event)).length;
    const clicked = mine.filter((e: any) => e.last_event === "clicked").length;
    await admin.from("diamond_ai_broadcasts").update({ delivered, opened, clicked, score: clicked * 5 + opened, scored: true }).eq("id", b.id);
    out.push({ tier: b.tier, subject: b.subject, angle: b.angle, reasoning: b.reasoning, recipients: b.recipients, opened, clicked });
  }
  return out;
}
async function updatePlaybooks(scored: any[]): Promise<number> {
  if (!scored.length) return 0;
  const byTier: Record<string, any[]> = {};
  for (const r of scored) (byTier[r.tier] ||= []).push(r);
  let updated = 0;
  for (const [tier, rows] of Object.entries(byTier)) {
    const goal = TIERS.find((t) => t.key === tier)?.goal || "";
    const { data: cur } = await admin.from("diamond_ai_learnings").select("playbook, emails_learned").eq("tier", tier).maybeSingle();
    const results = rows.map((r) => `- \"${r.subject}\" [${r.angle || "?"}] | theory: ${r.reasoning || "(none)"} | ${r.opened}/${r.recipients} opened, ${r.clicked} clicked`).join("\n");
    let pb = cur?.playbook || "";
    try {
      const txt = await llm(PLAYBOOK_SYSTEM, `Tier goal: ${goal}\nCurrent playbook:\n${pb || "(empty)"}\nNew send results since last update:\n${results}\nReturn the updated playbook (<=8 bullets).`, 0.4);
      if (txt) pb = txt;
    } catch (_e) { /* keep old playbook on error */ }
    await admin.from("diamond_ai_learnings").upsert({ tier, playbook: pb, emails_learned: (cur?.emails_learned || 0) + rows.length, updated_at: new Date().toISOString() });
    updated++;
  }
  return updated;
}
async function resetQueue() {
  const { data: q } = await admin.from("diamond_ai_broadcasts").select("id, broadcast_id").gte("sent_at", new Date().toISOString());
  let cancelled = 0, failed = 0;
  for (const r of q || []) {
    let ok = true;
    if (r.broadcast_id) { const res = await rf("POST", `broadcasts/${r.broadcast_id}/cancel`); ok = res.status < 300 || res.status === 404; }
    if (ok) { await admin.from("diamond_ai_broadcasts").delete().eq("id", r.id); cancelled++; } else failed++;
  }
  return { cancelled, failed };
}
// One-off backfill for the pre-v9 queue: the old broadcaster never logged a reasoning,
// and it scored emails before the playbook table existed. Here we (1) reconstruct the AI's
// theory for every reasoning-less email and (2) seed each tier's playbook from the real
// opens/clicks ALREADY stored on scored rows. No Resend writes — the scheduled sends are
// untouched; we only fill in our own dashboard fields. Going forward the live run logs both natively.
const BACKFILL_SYSTEM = `You are reconstructing the email strategist's own theory for an ALREADY-WRITTEN marketing email for Diamond Taste (Aisha, a fresh-baked cake brand in Abuja). In 2-3 first-person sentences, state the most likely hypothesis for why THIS subject + angle would earn opens and especially CLICKS from THIS audience tier on THIS weekday. Be concrete and concise. Output ONLY the reasoning text, no preamble, no quotes.`;
async function backfillReasoning(): Promise<{ filled: number }> {
  const { data: rows } = await admin.from("diamond_ai_broadcasts").select("*").is("reasoning", null);
  let filled = 0;
  for (const r of rows || []) {
    const tier = TIERS.find((t) => t.key === r.tier);
    const day = String(r.sent_at || "").slice(0, 10);
    const weekday = r.sent_at ? new Date(r.sent_at).toLocaleDateString("en-GB", { weekday: "long", timeZone: "Africa/Lagos" }) : "";
    const user = `Tier: ${r.tier} — ${tier?.goal || ""}\nSend day: ${weekday}, ${day}\nSubject: "${r.subject}"\nAngle: ${r.angle || "(none)"}\nBody:\n${r.body || "(not stored)"}`;
    let txt = "";
    try { txt = await llm(BACKFILL_SYSTEM, user, 0.5); } catch (_e) { /* skip on error */ }
    if (txt) { await admin.from("diamond_ai_broadcasts").update({ reasoning: txt }).eq("id", r.id); filled++; }
  }
  return { filled };
}
async function seedPlaybooks(): Promise<number> {
  // Build the first playbook from rows that already have real delivery data, using the DB's
  // stored opens/clicks (NOT a fresh Resend fetch, which may have aged out of the window).
  const { data: rows } = await admin.from("diamond_ai_broadcasts").select("*").eq("scored", true).gt("delivered", 0);
  if (!rows?.length) return 0;
  const shaped = rows.map((r: any) => ({ tier: r.tier, subject: r.subject, angle: r.angle, reasoning: r.reasoning, recipients: r.recipients, opened: r.opened, clicked: r.clicked }));
  return await updatePlaybooks(shaped);
}
const dstr = (d: Date) => d.toISOString().slice(0, 10);
function atHour(dateStr: string): Date { return new Date(`${dateStr}T${String(SEND_HOUR_UTC).padStart(2, "0")}:00:00.000Z`); }
function addDays(dateStr: string, n: number): string { const d = new Date(`${dateStr}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return dstr(d); }
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  if (!OR_KEY) return json({ error: "OPENROUTER_API_KEY not set" }, 400);
  if (url.searchParams.get("mode") === "reset") { const r = await resetQueue(); return json(r); }
  if (url.searchParams.get("mode") === "backfill") { const bf = await backfillReasoning(); const playbooks = await seedPlaybooks(); return json({ ...bf, playbooks }); }
  const scoredRows = await scorePast();
  const playbooks = await updatePlaybooks(scoredRows);
  if (url.searchParams.get("mode") === "score") return json({ scored: scoredRows.length, playbooks });
  const now = new Date();
  const today = dstr(now);
  const daysParam = parseInt(url.searchParams.get("days") || "", 10);
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 14) : 1;
  const { data: custs } = await admin.from("diamond_customers").select("resend_tier").not("email", "is", null);
  const counts: Record<number, number> = {};
  for (const c of custs || []) counts[c.resend_tier || 1] = (counts[c.resend_tier || 1] || 0) + 1;
  let imgI = (await admin.from("diamond_ai_broadcasts").select("id", { count: "exact", head: true })).count || 0;
  // SOURCE OF TRUTH: read Resend and mark every AUDIENCE+date that already has a non-cancelled
  // broadcast of ANY name. We only schedule on a FREE date for that audience, so a customer can never
  // get two broadcasts in one day (covers dtai:, anything).
  const blist = ((await (await rf("GET", "broadcasts")).json()).data) || [];
  const taken = new Set<string>();
  for (const b of blist) {
    if (String(b.status || "").toLowerCase().includes("cancel")) continue;
    const aud = b.audience_id || b.segment_id;
    const date = String(b.scheduled_at || "").slice(0, 10);
    if (aud && date) taken.add(`${aud}:${date}`);
  }
  const out: any[] = [];
  for (const tier of TIERS) {
    if (!counts[tier.tn]) { out.push({ tier: tier.key, skipped: "no contacts" }); continue; }
    const { data: pbRow } = await admin.from("diamond_ai_learnings").select("playbook").eq("tier", tier.key).maybeSingle();
    const { data: recent } = await admin.from("diamond_ai_broadcasts").select("subject").eq("tier", tier.key).order("sent_at", { ascending: false }).limit(6);
    const avoid = (recent || []).map((r: any) => r.subject);
    const added: any[] = [];
    let cursor = today;
    for (let k = 0; k < days; k++) {
      // advance to the next FREE future date for this AUDIENCE (no existing broadcast of any name)
      let guard = 0;
      do { cursor = addDays(cursor, 1); guard++; } while (taken.has(`${tier.id}:${cursor}`) && guard < 120);
      if (taken.has(`${tier.id}:${cursor}`)) { added.push({ skipped: "no free date in window" }); break; }
      const when = atHour(cursor);
      if (when.getTime() <= now.getTime() + 60_000) continue;
      const weekday = when.toLocaleDateString("en-GB", { weekday: "long", timeZone: "Africa/Lagos" });
      let gen: any = null;
      try { gen = await generate(tier, pbRow?.playbook || "", avoid, cursor, weekday); } catch (e) { added.push({ date: cursor, error: "gen: " + String(e) }); break; }
      if (!gen?.subject || !gen?.body) { added.push({ date: cursor, error: "bad LLM output" }); break; }
      const subject = String(gen.subject).replace(/\{first_name\}/gi, "").trim();
      avoid.unshift(subject);
      if (dry) { taken.add(`${tier.id}:${cursor}`); added.push({ date: cursor, weekday, subject, angle: gen.angle, reasoning: gen.reasoning }); continue; }
      const img = IMAGES[imgI++ % IMAGES.length];
      const cr = await (await rf("POST", "broadcasts", { name: `dtai:${tier.key}:${cursor}`, audience_id: tier.id, from: FROM, reply_to: REPLY, subject, html: buildHtml(gen.body, gen.cta_label || "Order now", gen.cta_url || "/shop", img) })).json();
      if (!cr.id) { added.push({ date: cursor, error: "create: " + JSON.stringify(cr) }); break; }
      await (await rf("POST", `broadcasts/${cr.id}/send`, { scheduled_at: when.toISOString() })).json();
      await admin.from("diamond_ai_broadcasts").insert({ tier: tier.key, subject, body: gen.body, angle: gen.angle || null, reasoning: gen.reasoning || null, image: img, cta_label: gen.cta_label || null, cta_url: gen.cta_url || "/shop", broadcast_id: cr.id, recipients: counts[tier.tn], sent_at: when.toISOString() });
      taken.add(`${tier.id}:${cursor}`);
      added.push({ date: cursor, weekday, subject, angle: gen.angle, reasoning: gen.reasoning, scheduled: true });
    }
    out.push({ tier: tier.key, added });
  }
  return json({ scored: scoredRows.length, playbooks, dry, today, appended_per_tier: days, results: out });
});
