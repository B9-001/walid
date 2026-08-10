import { supabase } from "./supabase";

// Units actually sold per product (by product_id slug), from diamond_orders, via the
// diamond_product_sales() RPC. Used to rank products by real bestsellers on the home
// "New & Bestselling" section and the shop grid. Returns {} on any failure so ranking
// silently falls back to whatever order the caller already had.
export async function getProductSales(): Promise<Record<string, number>> {
  try {
    const { data } = await supabase.rpc("diamond_product_sales");
    const m: Record<string, number> = {};
    for (const r of (data as { product_id: string; sold: number }[]) || []) {
      if (r.product_id) m[r.product_id] = Number(r.sold) || 0;
    }
    return m;
  } catch {
    return {};
  }
}

// Sort a product list by units sold (desc), then featured, then keep prior order. Mutates a copy.
export function rankBySales<T extends { product_id?: string | null; featured?: boolean | null }>(
  products: T[],
  sales: Record<string, number>,
): T[] {
  return [...products].sort((a, b) => {
    const sa = sales[a.product_id || ""] || 0;
    const sb = sales[b.product_id || ""] || 0;
    if (sb !== sa) return sb - sa;
    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  });
}
