import crypto from "crypto";

const hash = (v: string) =>
  crypto.createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

export async function POST(req: Request) {
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
  const token = process.env.FB_CAPI_TOKEN;
  if (!pixelId || !token) {
    return Response.json({ ok: false, reason: "missing-config" }, { status: 200 });
  }

  let payload: {
    eventName?: string;
    eventId?: string;
    email?: string;
    phone?: string;
    value?: number;
    currency?: string;
    sourceUrl?: string;
    fbp?: string;
    fbc?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 200 });
  }

  const { eventName, eventId, email, phone, value, currency = "NGN", sourceUrl, fbp, fbc } = payload;
  if (!eventName) return Response.json({ ok: false, reason: "no-event" }, { status: 200 });

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

  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        ...(eventId ? { event_id: eventId } : {}),
        action_source: "website",
        ...(sourceUrl ? { event_source_url: sourceUrl } : {}),
        user_data: userData,
        custom_data: { ...(value != null ? { value } : {}), currency },
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    const json = await res.json();
    return Response.json({ ok: res.ok, fb: json }, { status: 200 });
  } catch (e) {
    return Response.json({ ok: false, reason: String(e) }, { status: 200 });
  }
}
