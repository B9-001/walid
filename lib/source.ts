// Campaign / link-source attribution. When someone lands from a tagged link we
// remember where they came from, so it can be stamped onto their order/customer.
//
// Meta stamps utm_source=ig on EVERY Instagram click — paid ads AND link-in-bio
// alike — so utm_source ALONE can't tell them apart. But the rest of the UTMs can:
// ads carry utm_medium=paid (+ utm_id/utm_campaign); bio carries utm_medium=social
// or utm_content=link_in_bio. classify() turns those patterns into clean labels:
//   ?source=X (manual)   -> X            (always wins: whatsapp, emailmarketing, …)
//   utm_medium=paid      -> "<src>-ads"  (ig-ads, fb-ads)
//   link in bio / social -> "bio"
//   any other utm_source -> its raw value (ig, fb, …)
//   nothing              -> null  (→ shown as "Direct")
//
// Last-touch: a new tagged link overwrites the stored source; an untagged visit
// leaves the previous value intact.

const KEY = "dt_source";          // last-touch (what they arrived with this time)
const FIRST_KEY = "dt_source_first"; // first-touch (sticky — the source that originated them)
const SEEN_KEY = "dt_first_seen";    // ISO timestamp of that first tagged touch
const VID_KEY = "dt_vid";            // persistent first-party visitor id

function newId(): string {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch { /* fall through */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Stable visitor id, created once and reused across visits — lets us link a
// person's earlier ad click to a later purchase (even in a new session).
export function getVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(VID_KEY);
    if (!id) { id = newId(); localStorage.setItem(VID_KEY, id); }
    return id;
  } catch { return null; }
}

function classify(p: URLSearchParams): string | null {
  const clean = (s: string | null) => (s || "").trim().toLowerCase();

  // 1. A deliberate ?source= always wins (our own tags: whatsapp, emailmarketing…).
  const source = (p.get("source") || "").trim();
  if (source) return source.slice(0, 60);

  const utmSource = clean(p.get("utm_source"));
  const utmMedium = clean(p.get("utm_medium"));
  const utmContent = clean(p.get("utm_content"));

  // 2. Paid ads — utm_medium=paid, or the ad id Meta only puts on ad links.
  if (utmMedium === "paid" || p.get("utm_id")) {
    return (utmSource ? `${utmSource}-ads` : "ads").slice(0, 60);
  }
  // 3. Link in bio / organic social.
  if (utmContent === "link_in_bio" || utmMedium === "social") return "bio";
  // 4. Any other tagged source (e.g. organic ig/fb carrying only utm_source).
  if (utmSource) return utmSource.slice(0, 60);

  return null;
}

export function captureSource(): void {
  if (typeof window === "undefined") return;
  try {
    getVisitorId(); // ensure every visitor is counted, tagged or not
    const v = classify(new URLSearchParams(window.location.search));
    if (v) {
      localStorage.setItem(KEY, v); // last-touch always updates
      // First-touch is sticky: only set the first time we ever see a tagged source,
      // so a later bio visit can't steal credit from the ad that originated them.
      if (!localStorage.getItem(FIRST_KEY)) {
        localStorage.setItem(FIRST_KEY, v);
        localStorage.setItem(SEEN_KEY, new Date().toISOString());
      }
    }
  } catch { /* ignore */ }
}

export function getSource(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

// First-touch source (the original ad/bio that brought them) and when.
export function getFirstSource(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(FIRST_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch { return null; }
}

export function getFirstSeen(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(SEEN_KEY) || null; } catch { return null; }
}
