"use client";

// First-party visitor analytics. Writes lightweight events to Supabase
// (diamond_analytics_events) using the anon client (insert-only RLS).

import { supabase } from "@/lib/supabase";

const SID_KEY = "dt_sid";

function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = localStorage.getItem(SID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(SID_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

function device(): string {
  if (typeof navigator === "undefined") return "unknown";
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

type EventFields = {
  path?: string;
  label?: string;
  href?: string;
  value?: number;
  duration_ms?: number;
};

export function track(eventType: string, fields: EventFields = {}): void {
  if (typeof window === "undefined") return;
  const row = {
    session_id: sessionId(),
    event_type: eventType,
    path: fields.path ?? window.location.pathname,
    label: fields.label ?? null,
    href: fields.href ?? null,
    referrer: document.referrer || null,
    value: fields.value ?? null,
    duration_ms: fields.duration_ms ?? null,
    device: device(),
    user_agent: navigator.userAgent.slice(0, 300),
  };
  // fire-and-forget
  supabase.from("diamond_analytics_events").insert(row).then(() => {}, () => {});
}

export function trackPageView(path: string) {
  track("page_view", { path });
}

export function trackClick(label: string, href?: string) {
  track("click", { label, href });
}

export function trackExit(path: string, durationMs: number) {
  track("exit", { path, duration_ms: durationMs });
}
