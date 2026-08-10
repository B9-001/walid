"use client";

import { supabase } from "./supabase";

// Live stock helpers. stock_level === null means the product is not tracked
// (unlimited); a number is the hard cap; an inactive/removed product is treated
// as 0 so it can never be purchased.

export type StockIssue = {
  product_id: string;
  name: string;
  requested: number;
  available: number; // current sellable quantity (0 = sold out / unavailable)
};

// Current sellable quantity per product_id. `null` = untracked (unlimited).
export async function fetchStockLevels(
  productIds: string[]
): Promise<Record<string, number | null>> {
  const ids = Array.from(new Set(productIds)).filter(Boolean);
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("diamond_products")
    .select("product_id, stock_level, active")
    .in("product_id", ids);

  const map: Record<string, number | null> = {};
  if (!error) {
    for (const r of data || []) {
      map[r.product_id] = r.active === false ? 0 : (r.stock_level as number | null);
    }
  }
  // Anything we couldn't find (deleted) is unbuyable.
  for (const id of ids) if (!(id in map)) map[id] = 0;
  return map;
}

// Check live stock for a single product against a desired quantity.
// Returns the available count (or `null` if unlimited) and whether the qty fits.
export async function checkOne(
  productId: string,
  desiredQty: number
): Promise<{ ok: boolean; available: number | null }> {
  const map = await fetchStockLevels([productId]);
  const available = map[productId] ?? 0;
  if (available === null) return { ok: true, available: null };
  return { ok: available >= desiredQty, available };
}

// Check a whole set of cart lines. Returns the lines that can't be fulfilled at
// the requested quantity (empty array = everything is in stock).
export async function checkStock(
  lines: { product_id: string; name: string; quantity: number }[]
): Promise<StockIssue[]> {
  if (lines.length === 0) return [];
  const map = await fetchStockLevels(lines.map((l) => l.product_id));
  const issues: StockIssue[] = [];
  for (const l of lines) {
    const available = map[l.product_id];
    if (available === null || available === undefined) continue; // unlimited
    if (available < l.quantity) {
      issues.push({ product_id: l.product_id, name: l.name, requested: l.quantity, available });
    }
  }
  return issues;
}

// Human-readable summary of stock problems, for inline error messages.
export function describeIssues(issues: StockIssue[]): string {
  return issues
    .map((i) =>
      i.available === 0
        ? `${i.name} is now sold out`
        : `Only ${i.available} of ${i.name} left (you have ${i.requested})`
    )
    .join("; ");
}
