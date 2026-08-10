"use client";

// Behavioural tracking for SIGNED-IN customers only. The three behaviour tags form
// a single mini-funnel and are mutually exclusive — a customer sits at exactly one
// stage at a time (or none):
//
//   Viewed a product  →  Added to cart  →  Abandoned checkout  →  (bought = none)
//
// Each tag is just the presence of a timestamp on the diamond_customers row
// (last_viewed_at / last_added_at / last_checkout_at). Advancing the funnel sets
// the new stage's timestamp and clears the others, so a buyer is never still tagged
// "viewed", and an abandoned-checkout customer isn't also tagged "added to cart".
// We never DEMOTE: viewing a product while already at checkout keeps the hotter
// checkout tag. Product names are kept for email personalisation. Anonymous
// visitors are skipped (no customer record).

import { supabase } from "@/lib/supabase";

export type CustomerEventType = "view_product" | "add_to_cart" | "checkout";

// Funnel rank — higher wins. 0 = no stage.
const RANK: Record<CustomerEventType, number> = { view_product: 1, add_to_cart: 2, checkout: 3 };

export async function trackCustomerEvent(
  type: CustomerEventType,
  data: { product_id?: string | null; product_name?: string | null; value?: number | null } = {}
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user?.email) return; // only track signed-in customers

    const now = new Date().toISOString();

    // Where are they in the funnel right now? (checkout > cart > viewed)
    const { data: cur } = await supabase
      .from("diamond_customers")
      .select("last_viewed_at, last_added_at, last_checkout_at")
      .eq("email", user.email)
      .maybeSingle();
    const curRank = cur?.last_checkout_at ? 3 : cur?.last_added_at ? 2 : cur?.last_viewed_at ? 1 : 0;

    const patch: Record<string, unknown> = { email: user.email, user_id: user.id, last_seen_at: now };

    // Always refresh the product context for the stage that fired (handy for email
    // personalisation), even on a non-advancing event.
    if (type === "view_product") {
      patch.last_viewed_product_id = data.product_id ?? null;
      patch.last_viewed_product_name = data.product_name ?? null;
    } else if (type === "add_to_cart") {
      patch.last_added_product_id = data.product_id ?? null;
      patch.last_added_product_name = data.product_name ?? null;
    }

    // Only advance (and clear earlier/later sibling stages) on a forward move. A
    // backward move (e.g. browsing a product while mid-checkout) keeps the hotter tag.
    if (RANK[type] >= curRank) {
      if (type === "view_product") {
        patch.last_viewed_at = now;
        patch.last_added_at = null;
        patch.last_checkout_at = null;
      } else if (type === "add_to_cart") {
        patch.last_added_at = now;
        patch.last_viewed_at = null;
        patch.last_checkout_at = null;
      } else if (type === "checkout") {
        patch.last_checkout_at = now;
        patch.last_viewed_at = null;
        patch.last_added_at = null;
      }
    }

    // Must await — supabase query builders are lazy and only run when awaited.
    const { error } = await supabase.from("diamond_customers").upsert(patch, { onConflict: "email" });
    if (error) console.warn("[track] customer activity update failed:", error.message);
  } catch {
    /* best-effort — never block the UI on tracking */
  }
}

// Take a signed-in customer out of the behaviour funnel entirely (clears all three
// stages). Call this the moment their cart is no longer an open, unpaid cart — i.e.
// they paid, or they emptied their cart. Without this, buyers (and people who
// cleared their cart) stay tagged forever and keep getting recovery emails for a
// cart that no longer exists.
export async function clearCartSignals(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user?.email) return; // only signed-in customers have a record/signals

    const { error } = await supabase
      .from("diamond_customers")
      .update({
        last_viewed_at: null,
        last_added_at: null,
        last_added_product_id: null,
        last_added_product_name: null,
        last_checkout_at: null,
      })
      .eq("email", user.email);
    if (error) console.warn("[track] clear cart signals failed:", error.message);
  } catch {
    /* best-effort — never block the UI on tracking */
  }
}
