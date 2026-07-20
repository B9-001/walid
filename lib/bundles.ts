// Build-Your-Box bundle offers (thepufflette.co).
//
// Two "build your own" bundles + one add-on upgrade. Money is kobo everywhere.
// Every bundle INCLUDES FREE DELIVERY, and coupons NEVER apply while a bundle is
// in the cart — see BUNDLE-OFFERS-PLAN.md.
//   • Sweet Box  — pick any 3 from our gourmet pancakes & puff puff, pay the
//                  picked items' price, free delivery is the perk (payItemPrice: no discount).
//   • Box of 5   — pick any 5 for a fixed ₦25,500 (save up to ₦4,500) + free delivery.
// Bundles are stored as a single cart line carrying `bundle.components` (real
// product slugs); at order time we flatten each box into its component slugs with
// the bundle price prorated across them, so the stock trigger + Paystack webhook
// keep working unchanged.

import type { CartItem, BundleComponent } from "./types";

export type BundleSlug = "sweet-box" | "box-of-5";

export type BundleConfig = {
  slug: BundleSlug;
  name: string;
  tagline: string;      // "Pick any 3"
  picks: number;
  priceKobo: number;    // fixed box price; ignored when payItemPrice is true
  // Sweet Box: the customer pays the picked items' combined price (no product
  // discount) — the perk is free delivery. Box of 5 has a fixed price instead.
  payItemPrice?: boolean;
  image: string;        // /public path
  blurb: string;
  worthUpToKobo: number; // priciest possible pick — for the "worth up to" badge
  saveUpToKobo: number;  // worthUpTo − price — for the "save up to" badge (0 = free-delivery-only)
  fromKobo?: number;     // cheapest a payItemPrice box can cost (3 × cheapest pick) — for "From ₦X"
  // Pool selection — either an explicit slug list OR category-based with exclusions.
  poolSlugs?: string[];
  poolCategories?: string[];
  excludeSlugs?: string[];
  // Disable Confirm while the picked worth is below the fixed price (Box of 5:
  // cheap-heavy picks could be worth less than ₦25,500).
  floorGuard: boolean;
};

export const BUNDLES: BundleConfig[] = [
  {
    slug: "sweet-box",
    name: "Sweet Box",
    tagline: "Pick any 3",
    picks: 3,
    priceKobo: 0,          // dynamic — you pay the picked items' price
    payItemPrice: true,
    image: "/bundles/sweet-box.jpg",
    blurb: "Pick any 3 of our gourmet pancakes & puff puff and we deliver them free — no ₦20,000 minimum.",
    worthUpToKobo: 2_100_000, // 3 × ₦7,000 (priciest picks)
    saveUpToKobo: 0,          // free delivery is the deal, not a product discount
    fromKobo: 1_350_000,      // 3 × ₦4,500 (cheapest picks)
    poolCategories: ["Gourmet Puff Puff", "Gourmet Pancakes"],
    floorGuard: false,
  },
  {
    slug: "box-of-5",
    name: "Build Your Box of 5",
    tagline: "Pick any 5",
    picks: 5,
    priceKobo: 2_550_000, // ₦25,500
    image: "/bundles/box-of-5.jpg",
    blurb: "Any five gourmet puff puff & pancakes for ₦25,500 — save up to ₦4,500, delivered free.",
    worthUpToKobo: 3_000_000, // 5 × ₦6,000
    saveUpToKobo: 450_000,    // up to ₦4,500
    poolCategories: ["Gourmet Puff Puff", "Gourmet Pancakes"],
    floorGuard: true,
  },
];

export function getBundle(slug: string): BundleConfig | undefined {
  return BUNDLES.find((b) => b.slug === slug);
}

// Does a product belong in this bundle's pick pool?
export function inPool(cfg: BundleConfig, p: { product_id: string; category: string }): boolean {
  if (cfg.excludeSlugs?.includes(p.product_id)) return false;
  if (cfg.poolSlugs) return cfg.poolSlugs.includes(p.product_id);
  if (cfg.poolCategories) return cfg.poolCategories.includes(p.category);
  return false;
}

// ── ₦500 Classic Pancake Stack upgrade ─────────────────────────────────────
export const UPGRADE_MIN = 1_500_000;               // ₦15,000 threshold
export const UPGRADE_PRICE = 50_000;                // ₦500
export const UPGRADE_PRODUCT_ID = "classic-pancake-stack";

// ── The Pufflette Duo Box — fixed combo promo, no picker ────────────────────
// A single named product (create it in /admin/products with this exact
// product_id) rather than a `bundle` cart line: the picker-based bundles
// above need every component to be a real live product so reconcile() can
// validate it, but a Duo Box is one fixed SKU — it just needs to exist.
// Price/old_price/image/stock are read live from that product; the
// marketing copy (composition, badges) is fixed in DuoBoxSection.tsx.
export const DUO_BOX_PRODUCT_ID = "the-pufflette-duo-box"; // = the auto-slug of the product name "The Pufflette Duo Box"
export const DUO_BOX_COMPARE_AT_KOBO = 1_599_800; // ₦15,998 — fallback if old_price isn't set

// ── Cart helpers ────────────────────────────────────────────────────────────

export function isBundleLine(it: CartItem): boolean {
  return !!it.bundle;
}

// The Duo Box isn't a `bundle` cart line (see above) but gets the same
// free-delivery + no-coupon-stacking treatment as a real bundle — it's
// already a fixed combo deal.
export function hasBundle(items: CartItem[]): boolean {
  return items.some((it) => !!it.bundle || it.product_id === DUO_BOX_PRODUCT_ID);
}

// Sum of the real prices of a set of picked components (kobo).
export function componentsWorth(components: BundleComponent[]): number {
  return components.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
}

// Savings for one cart line (bundle or upgrade), in kobo.
export function lineSaving(it: CartItem): number {
  if (it.bundle) return Math.max(0, it.bundle.worth - it.price * it.quantity);
  if (it.upgrade && it.worth) return Math.max(0, it.worth - it.price * it.quantity);
  return 0;
}

// Total savings across the whole cart (kobo).
export function cartSavings(items: CartItem[]): number {
  return items.reduce((s, it) => s + lineSaving(it), 0);
}

// Subtotal of "normal" full-price lines only — excludes bundles and the upgrade.
// This is what unlocks the ₦500 upgrade (full-price-items-only basis).
export function fullPriceSubtotal(items: CartItem[]): number {
  return items.reduce(
    (s, it) => (it.bundle || it.upgrade ? s : s + it.price * it.quantity),
    0
  );
}

// ── Order flattening ────────────────────────────────────────────────────────
// Expand cart items into the order `items[]` the DB stock trigger + webhook
// expect: real product slugs with the fixed bundle price prorated across the
// picked components (largest-remainder rounding so the parts sum EXACTLY to the
// bundle price). Non-bundle lines pass through unchanged.

export type OrderLine = {
  product_id: string;
  name: string;
  price: number;     // kobo, unit price
  quantity: number;
  image: string | null;
  bundle?: string;   // slug, for reporting
  upgrade?: boolean; // the ₦500 pancake stack add-on, for reporting
  note?: string;     // customer's special instructions for this item
};

export function expandForOrder(items: CartItem[]): OrderLine[] {
  const out: OrderLine[] = [];
  for (const it of items) {
    if (!it.bundle) {
      out.push({
        product_id: it.product_id,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        image: it.image,
        ...(it.upgrade ? { upgrade: true } : {}),
        ...(it.note ? { note: it.note } : {}),
      });
      continue;
    }

    // One "unit" per picked item (quantity expanded), weighted by real price.
    const units = it.bundle.components.flatMap((c) =>
      Array.from({ length: c.quantity }, () => ({
        product_id: c.product_id,
        name: c.name,
        image: c.image,
        weight: c.unitPrice,
      }))
    );
    if (units.length === 0) continue;

    const linePrice = it.price * it.quantity; // qty is 1 for bundles
    const totalWeight = units.reduce((s, u) => s + u.weight, 0) || units.length;
    const raw = units.map((u) => (linePrice * u.weight) / totalWeight);
    const alloc = raw.map((r) => Math.floor(r));
    let remainder = linePrice - alloc.reduce((s, a) => s + a, 0);
    // Hand the leftover kobo to the units with the largest fractional part.
    raw
      .map((r, i) => ({ i, frac: r - Math.floor(r) }))
      .sort((a, b) => b.frac - a.frac)
      .forEach(({ i }) => {
        if (remainder > 0) { alloc[i] += 1; remainder -= 1; }
      });

    units.forEach((u, i) => {
      out.push({
        product_id: u.product_id,
        name: `${it.bundle!.name}: ${u.name}`,
        price: alloc[i],
        quantity: 1,
        image: u.image,
        bundle: it.bundle!.slug,
      });
    });
  }
  return out;
}
