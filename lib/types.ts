// Shared domain types. Money fields are in kobo (₦ × 100).

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
};

export type SizeTier = {
  label: string;
  price: number; // kobo
  serves?: string;
};

export type Product = {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  images: string[];
  base_price: number; // kobo
  old_price: number | null; // kept for future sale display
  sizes: SizeTier[];  // kept for future use, not shown in UI yet
  featured: boolean;
  active: boolean;
  stock_level: number | null; // null = unlimited; 0 = sold out
  preorder: boolean; // available to pre-order ahead of its release date
  preorder_release_at: string | null; // ISO timestamp the product becomes available
};

// One picked flavour inside a Build-Your-Box bundle. unitPrice is its real
// catalogue price (kobo) captured when it was picked — used to show the "worth"
// and to prorate the fixed bundle price back onto real product slugs at order time.
export type BundleComponent = {
  product_id: string;   // real product slug (drives stock)
  name: string;
  quantity: number;
  unitPrice: number;    // kobo
  image: string | null;
};

// Attached to a bundle cart line. The line's own `price` is the fixed bundle
// price (e.g. ₦12,000); `worth` is the sum of the components' real prices.
export type BundleMeta = {
  slug: string;         // "sweet-box" | "box-of-5"
  name: string;
  picks: number;
  worth: number;        // kobo
  components: BundleComponent[];
};

export type CartItem = {
  id: string;       // unique line id
  product_id: string;
  name: string;
  image: string | null;
  price: number;    // kobo, unit price
  quantity: number;
  preorder_release_at?: string | null; // set when the item is a pre-order
  // Build-Your-Box bundle line (Sweet Box / Box of 5). When set, this line is a
  // bundle: `price` is the fixed bundle price and `product_id` is a synthetic
  // per-instance id so two differently-picked boxes never merge.
  bundle?: BundleMeta;
  // The ₦500 Classic Pancake Stack upgrade line. product_id is the real slug; it never
  // merges with a full-price line of the same product.
  upgrade?: boolean;
  // Real value (kobo) of this line for savings display (upgrade lines). Bundles
  // carry their worth in `bundle.worth` instead.
  worth?: number;
  // Customer's special instructions for this specific item (e.g. "no nuts please").
  note?: string;
};

export type OrderItem = {
  product_id: string;
  name: string;
  image?: string | null;
  price: number; // kobo, unit price
  quantity: number;
  bundle?: string; // bundle slug, set when this line came from a Build-Your-Box bundle
  upgrade?: boolean; // the ₦500 Classic Pancake Stack upgrade line
  preorder_release_at?: string | null;
  note?: string; // customer's special instructions for this item
};

export type Order = {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string | null;
  customer_city: string | null;
  customer_state: string | null;
  delivery_method: string;
  delivery_fee: number; // kobo
  service_fee: number; // kobo
  required_date: string | null;
  required_time: string | null;
  items: OrderItem[];
  subtotal: number; // kobo
  coupon_code: string | null;
  coupon_discount: number; // kobo
  total_price: number; // kobo
  status: string;
  payment_status: string;
  payment_reference: string | null;
  notes: string | null;
  referral_source: string | null;
  created_at: string;
  updated_at: string;
};

export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  usage_limit: number | null;
  usage_count: number;
  expiry_date: string | null;
  is_active: boolean;
  first_order_only: boolean;
  is_public: boolean;
  category: string | null;
  owner_user_id: string | null;
  is_referral_reward: boolean;
  referral_goal: number | null;
  stackable: boolean;
  created_at: string;
};

export type Customer = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  delivery_area: string | null;
  referral_code: string | null;
  referred_by: string | null;
  referral_reward_given: boolean;
  lifecycle_stage: string;
  stage_locked: boolean;
  stage_changed_at: string | null;
  orders_count: number;
  total_spent: number; // kobo
  referral_source: string | null;
  last_viewed_at: string | null;
  last_viewed_product_id: string | null;
  last_viewed_product_name: string | null;
  last_added_at: string | null;
  last_added_product_id: string | null;
  last_added_product_name: string | null;
  last_checkout_at: string | null;
  created_at: string;
  last_seen_at: string | null;
};

export type DeliveryFee = {
  id: string;
  location: string;
  fee: number; // kobo
  is_active: boolean;
  sort_order: number;
};

export type HeroImage = {
  id: string;
  image_url: string;
  heading: string | null;
  subheading: string | null;
  order_index: number;
};

export type SiteSettings = {
  id: string;
  delivery_fee: number;
  free_delivery_threshold: number | null;
  contact_phone: string | null;
  contact_email: string | null;
  whatsapp_number: string | null;
  instagram_handle: string | null;
  pickup_address: string | null;
  announcement: string | null;
  business_hours: import("./hours").BusinessHours | null;
};
