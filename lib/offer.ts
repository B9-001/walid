// "Offer 1" — free delivery on orders over ₦20,000. A marketing landing page that
// funnels into the normal cart, where customers also get to stack vouchers on top
// of the free delivery.

export const OFFER_ID = "offer1";
export const OFFER_FREE_DELIVERY_MIN = 2_000_000; // ₦20,000 in kobo — free delivery for everyone
const KEY = "dt_offer";

// The threshold actually in force. Admin's "Free delivery over" setting wins
// when it's set; otherwise the ₦20,000 default above applies.
//
// Every place that mentions free delivery — the announcement bar, the cart's
// progress bar, the checkout hint and the checkout's own fee maths — must read
// this same function. They used to disagree: the fee maths clamped the admin
// value with Math.min() while every display hardcoded ₦20,000, so an admin
// threshold of ₦15,000 silently gave free delivery at ₦15,000 while the cart
// still told customers to spend ₦20,000.
export function freeDeliveryMin(adminThresholdKobo?: number | null): number {
  return adminThresholdKobo && adminThresholdKobo > 0
    ? adminThresholdKobo
    : OFFER_FREE_DELIVERY_MIN;
}

// When delivery is free (order ≥ ₦20k) but the location is expensive (fee ≥ ₦5,000),
// we charge a service fee = deliveryFee − ₦4,500
//   ₦5,000 → ₦500, ₦5,500 → ₦1,000, ₦6,000 → ₦1,500, …
export const SERVICE_FEE_MIN_DELIVERY = 500_000; // ₦5,000 in kobo
export const SERVICE_FEE_BASE = 450_000;         // ₦4,500 in kobo

export function serviceFeeFor(baseDeliveryFeeKobo: number): number {
  return baseDeliveryFeeKobo >= SERVICE_FEE_MIN_DELIVERY ? baseDeliveryFeeKobo - SERVICE_FEE_BASE : 0;
}

export function isOfferMode(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(KEY) === OFFER_ID;
}

export function setOfferMode(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) localStorage.setItem(KEY, OFFER_ID);
  else localStorage.removeItem(KEY);
}

// Both funnels share the normal cart now, so vouchers and free delivery work
// together everywhere.
export function cartPath(): string {
  return "/cart";
}
