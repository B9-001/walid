import type { Product } from "./types";

// A product can be added straight to the cart (one click) when it has no size
// tiers to choose from and a fixed price. Otherwise we send them to the detail
// page to make their selection.
export function isQuickAdd(p: Pick<Product, "sizes" | "base_price" | "stock_level">): boolean {
  const noSizes = !p.sizes || p.sizes.length === 0;
  const soldOut = p.stock_level !== null && p.stock_level === 0;
  return noSizes && p.base_price > 0 && !soldOut;
}

// A product is "on pre-order" while it's flagged and its release time is still in
// the future. Once that time passes it behaves like any normal product.
export function isPreorder(p: Pick<Product, "preorder" | "preorder_release_at">): boolean {
  if (!p.preorder || !p.preorder_release_at) return false;
  return new Date(p.preorder_release_at).getTime() > Date.now();
}

// Friendly release label, e.g. "Sat 21 Jun · 3:00 pm".
export function formatPreorderDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date} · ${time}`;
}
