import { supabase } from "./supabase";

const REF_KEY = "dt_ref";

// Attribute the current visitor to the referrer whose code they arrived with.
// Safe to call at signup AND at checkout — it only sets referred_by once and
// never lets someone refer themselves. The reward itself is granted by a DB
// trigger when 3 referred customers have placed a paid order.
export async function attributeReferral(email: string, selfUserId: string | null): Promise<void> {
  if (typeof window === "undefined") return;
  const ref = localStorage.getItem(REF_KEY);
  if (!ref || !email) return;

  try {
    // Done server-side via RPC — it reads the referrer's row (which RLS now hides
    // from other customers) and only ever sets referred_by once, never self.
    await supabase.rpc("diamond_attribute_referral", {
      p_email: email.toLowerCase(),
      p_self: selfUserId,
      p_ref: ref,
    });
    localStorage.removeItem(REF_KEY);
  } catch {
    /* non-fatal */
  }
}
