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
  // The ₦500 Classic Milkcake upgrade line. product_id is the real slug; it never
  // merges with a full-price line of the same product.
  upgrade?: boolean;
  // Real value (kobo) of this line for savings display (upgrade lines). Bundles
  // carry their worth in `bundle.worth` instead.
  worth?: number;
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
