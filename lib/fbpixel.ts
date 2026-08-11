"use client";

// Meta Pixel + Conversions API helper.
// Fires the browser pixel AND the server-side CAPI event with a shared
// event_id so Meta deduplicates them (counts each conversion once).

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

type TrackOpts = { eventId?: string; email?: string | null; phone?: string | null };

function cookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

export function fbTrack(
  event: string,
  custom: Record<string, unknown> = {},
  opts: TrackOpts = {},
): void {
  const eventId = opts.eventId || uuid();

  // 1) Browser pixel
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", event, custom, { eventID: eventId });
  }

  // 2) Server-side CAPI (deduped via eventId)
  try {
    fetch("/api/capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        eventName: event,
        eventId,
        email: opts.email || undefined,
        phone: opts.phone || undefined,
        value: custom.value,
        currency: custom.currency || "NGN",
        sourceUrl: typeof window !== "undefined" ? window.location.href : "",
        fbp: cookie("_fbp") || undefined,
        fbc: cookie("_fbc") || undefined,
      }),
    });
  } catch {
    /* non-fatal */
  }
}
