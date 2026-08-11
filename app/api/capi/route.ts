import crypto from "crypto";
import { FB_PIXEL_ID } from "@/lib/meta";

const hash = (v: string) =>
  crypto.createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

export async function POST(req: Request) {
  const pixelId = FB_PIXEL_ID;
  const token = process.env.FB_CAPI_TOKEN;
  if (!pixelId || !token) {
    console.error("[CAPI] FB_CAPI_TOKEN is not set — dropping this event silently until it is configured.");
    return Response.json({ ok: false, reason: "missing-config" }, { status: 200 });
  }

  let payload: {
    eventName?: string;
    eventId?: string;
    email?: string;
    phone?: string;
    custom?: Record<string, unknown>;
    sourceUrl?: string;
    fbp?: string;
    fbc?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 200 });
  }

  const { eventName, eventId, email, phone, custom = {}, sourceUrl, fbp, fbc } = payload;
  if (!eventName) return Response.json({ ok: false, reason: "no-event" }, { status: 200 });
  const { currency = "NGN", ...restCustom } = custom as Record<string, unknown> & { currency?: string };

  const userData: Record<string, string[] | string> = {
    client_user_agent: req.headers.get("user-agent") || "",
  };
  if (email) userData.em = [hash(email)];
  if (phone) userData.ph = [hash(phone.replace(/\D/g, ""))];
  // IP + browser cookies give Meta match keys even on anonymous events
  // (ViewContent/AddToCart before checkout) — without at least one of these,
  // Meta rejects the event with "insufficient customer information".
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (ip) userData.client_ip_address = ip;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  // FB_TEST_EVENT_CODE is unset in normal operation — only set it temporarily
  // (Vercel env var) while watching Events Manager → Test Events, then unset
  // it again. Leaving it set permanently tags every real conversion as a test
  // event, which silently excludes them from ad optimization — that exact bug
  // (a hardcoded test_event_code) is why this is opt-in via env var, not code.
  const testEventCode = process.env.FB_TEST_EVENT_CODE || undefined;

  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        ...(eventId ? { event_id: eventId } : {}),
        action_source: "website",
        ...(sourceUrl ? { event_source_url: sourceUrl } : {}),
        user_data: userData,
        custom_data: { ...restCustom, currency },
      },
    ],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    const json = await res.json();
    if (!res.ok) console.error(`[CAPI] Meta rejected ${eventName}:`, JSON.stringify(json));
    return Response.json({ ok: res.ok, fb: json }, { status: 200 });
  } catch (e) {
    console.error(`[CAPI] request to Meta failed for ${eventName}:`, e);
    return Response.json({ ok: false, reason: String(e) }, { status: 200 });
  }
}
