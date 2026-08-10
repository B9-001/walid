import { supabase } from "./supabase";
import type { Coupon } from "./types";

export type CouponResult = {
  valid: boolean;
  message: string;
  code?: string;
  discount?: number; // kobo
  couponId?: string;
  stackable?: boolean; // false = can only be used on its own
};

export type CouponContext = { userId?: string | null; email?: string | null };
export type CartLine = { product_id: string; price: number; quantity: number };

const naira = (kobo: number) => "₦" + (kobo / 100).toLocaleString("en-NG");

async function customerHasOrders(ctx: CouponContext): Promise<boolean> {
  let q = supabase.from("diamond_orders").select("id", { count: "exact", head: true });
  if (ctx.userId && ctx.email) q = q.or(`customer_id.eq.${ctx.userId},customer_email.ilike.${ctx.email}`);
  else if (ctx.userId) q = q.eq("customer_id", ctx.userId);
  else if (ctx.email) q = q.ilike("customer_email", ctx.email);
  else return false;
  const { count } = await q;
  return (count ?? 0) > 0;
}

// product_id -> category name, for category-restricted coupons
async function categoriesFor(productIds: string[]): Promise<Record<string, string>> {
  if (!productIds.length) return {};
  const { data } = await supabase.from("diamond_products").select("product_id, category").in("product_id", productIds);
  const map: Record<string, string> = {};
  (data || []).forEach((p: { product_id: string; category: string }) => { map[p.product_id] = p.category; });
  return map;
}

function computeDiscount(c: Coupon, baseKobo: number): number {
  let discount: number;
  if (c.discount_type === "percentage") {
    discount = Math.round((baseKobo * Number(c.discount_value)) / 100);
    if (c.max_discount_amount && discount > c.max_discount_amount) discount = c.max_discount_amount;
  } else {
    discount = Math.round(Number(c.discount_value));
  }
  return Math.min(discount, baseKobo);
}

export async function validateCoupon(
  rawCode: string,
  subtotalKobo: number,
  ctx: CouponContext = {},
  items: CartLine[] = []
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { valid: false, message: "Enter a coupon code." };

  const { data, error } = await supabase
    .from("diamond_coupons")
    .select("*")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return { valid: false, message: "That coupon code isn't valid." };

  if (data.is_referral_reward) return { valid: false, message: "That coupon code isn't valid." };
  if (data.owner_user_id && data.owner_user_id !== ctx.userId) {
    return { valid: false, message: "This voucher isn't available on your account." };
  }
  if (data.expiry_date && new Date(data.expiry_date) < new Date(new Date().toDateString())) {
    return { valid: false, message: "This coupon has expired." };
  }
  if (data.usage_limit != null && data.usage_count >= data.usage_limit) {
    return { valid: false, message: "This coupon has already been used." };
  }
  if (data.min_order_amount && subtotalKobo < data.min_order_amount) {
    return { valid: false, message: `Spend at least ${naira(data.min_order_amount)} to use this coupon.` };
  }
  if (data.first_order_only) {
    if (!ctx.userId && !ctx.email) return { valid: false, message: "Sign in to use this first-order voucher." };
    if (await customerHasOrders(ctx)) return { valid: false, message: "This voucher is only valid on your first order." };
  }

  // Category restriction — discount applies to the eligible items only
  let baseKobo = subtotalKobo;
  if (data.category) {
    if (!items.length) return { valid: false, message: `Add a ${data.category} item to use this voucher.` };
    const cats = await categoriesFor(items.map((l) => l.product_id));
    const eligible = items.filter((l) => cats[l.product_id] === data.category);
    if (!eligible.length) return { valid: false, message: `This voucher only applies to ${data.category}.` };
    // For a free-item reward (100% off) cap at one item via max_discount_amount.
    baseKobo = eligible.reduce((s, l) => s + l.price * l.quantity, 0);
  }

  const discount = computeDiscount(data, baseKobo);
  return { valid: true, message: "Voucher applied!", code, discount, couponId: data.id, stackable: data.stackable !== false };
}

export type AvailableVoucher = {
  id: string;
  code: string;
  description: string | null;
  discountLabel: string;
  requirement: string | null;
  applicable: boolean;
  reason: string;
  discountPreview: number;
  minOrder: number;
  stackable: boolean;
  blockedBy: "expired" | "claimed" | "signin" | "firstorder" | "minorder" | "category" | null;
};

export async function getAvailableVouchers(
  subtotalKobo: number,
  ctx: CouponContext = {},
  items: CartLine[] = []
): Promise<AvailableVoucher[]> {
  let query = supabase.from("diamond_coupons").select("*").eq("is_active", true).eq("is_referral_reward", false);
  if (ctx.userId) query = query.or(`and(is_public.eq.true,owner_user_id.is.null),owner_user_id.eq.${ctx.userId}`);
  else query = query.eq("is_public", true).is("owner_user_id", null);
  const { data } = await query.order("min_order_amount", { ascending: true });
  if (!data) return [];

  let firstOrderEligible = false;
  if (ctx.userId || ctx.email) firstOrderEligible = !(await customerHasOrders(ctx));

  const cats = items.length ? await categoriesFor(items.map((l) => l.product_id)) : {};
  const now = new Date(new Date().toDateString());

  return (data as Coupon[]).map((c) => {
    let blockedBy: AvailableVoucher["blockedBy"] = null;
    let reason = "";

    // base for discount preview (eligible items if category-restricted)
    let baseKobo = subtotalKobo;
    let hasEligible = true;
    if (c.category) {
      const eligible = items.filter((l) => cats[l.product_id] === c.category);
      hasEligible = eligible.length > 0;
      baseKobo = eligible.reduce((s, l) => s + l.price * l.quantity, 0);
    }

    if (c.expiry_date && new Date(c.expiry_date) < now) { blockedBy = "expired"; reason = "Expired"; }
    else if (c.usage_limit != null && c.usage_count >= c.usage_limit) { blockedBy = "claimed"; reason = "Used"; }
    else if (c.first_order_only && !ctx.userId && !ctx.email) { blockedBy = "signin"; reason = "Sign in to use"; }
    else if (c.first_order_only && !firstOrderEligible) { blockedBy = "firstorder"; reason = "First order only"; }
    else if (c.min_order_amount && subtotalKobo < c.min_order_amount) { blockedBy = "minorder"; reason = `Add ${naira(c.min_order_amount - subtotalKobo)} more`; }
    else if (c.category && !hasEligible) { blockedBy = "category"; reason = `Add a ${c.category}`; }

    const discountLabel =
      c.discount_type === "percentage" ? `${Number(c.discount_value)}% OFF` : `${naira(Number(c.discount_value))} OFF`;

    const reqs: string[] = [];
    if (c.category) reqs.push(`${c.category} only`);
    if (c.first_order_only) reqs.push("First order only");
    if (c.min_order_amount) reqs.push(`Min order ${naira(c.min_order_amount)}`);
    if (c.expiry_date) reqs.push(`Expires ${c.expiry_date}`);

    return {
      id: c.id,
      code: c.code,
      description: c.description,
      discountLabel,
      requirement: reqs.length ? reqs.join(" · ") : null,
      applicable: blockedBy === null,
      reason,
      discountPreview: computeDiscount(c, baseKobo),
      minOrder: c.min_order_amount || 0,
      stackable: c.stackable !== false,
      blockedBy,
    };
  });
}

export async function incrementCouponUsage(couponId: string) {
  const { data } = await supabase.from("diamond_coupons").select("usage_count").eq("id", couponId).maybeSingle();
  if (data) {
    await supabase.from("diamond_coupons").update({ usage_count: (data.usage_count || 0) + 1 }).eq("id", couponId);
  }
}
