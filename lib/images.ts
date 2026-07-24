// Curated Unsplash fallback imagery for thepufflette.co.
// Used when admin-managed photos (hero slides, product/category images) are
// not yet uploaded, so the storefront always looks complete.
// All IDs verified to resolve at images.unsplash.com.

const U = (id: string, w = 1200, q = 80) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=${q}`;

// Tall, hero-friendly cake shots
export const HERO_IMAGES = [
  U("1578985545062-69928b1d9587", 1400), // pink layer cake
  U("1576618148400-f54bed99fcfd", 1400), // cake portrait
  U("1627834377411-8da5f4f09de8", 1400), // whole celebration cake
];

// General product/cake imagery, cycled deterministically per product
export const PRODUCT_IMAGES = [
  U("1565958011703-44f9829ba187", 900), // chocolate cake
  U("1563729784474-d77dbb933a9e", 900), // cupcakes
  U("1486427944299-d1955d23e34d", 900), // cake slice
  U("1464349095431-e9a21285b5f3", 900), // cake
  U("1535141192574-5d4897c12636", 900), // cupcake
  U("1571115177098-24ec42ed204d", 900), // birthday cake
  U("1558961363-fa8fdf82db35", 900),    // macarons
  U("1607478900766-efe13248b125", 900), // cupcake tray
];

// Category tiles keyed by common slugs, with a sensible default
const CATEGORY_IMAGES: Record<string, string> = {
  "birthday-cakes": U("1578985545062-69928b1d9587", 1000),
  "birthday": U("1578985545062-69928b1d9587", 1000),
  "cupcakes": U("1563729784474-d77dbb933a9e", 1000),
  "milk-cakes": U("1576618148400-f54bed99fcfd", 1000),
  "pastries": U("1599785209707-a456fc1337bb", 1000),
  "cookies": U("1551024601-bec78aea704b", 1000),
  "donuts": U("1542826438-bd32f43d626f", 1000),
  "bread": U("1509440159596-0249088772ff", 1000),
};
const CATEGORY_DEFAULTS = [
  U("1464349095431-e9a21285b5f3", 1000),
  U("1488477181946-6428a0291777", 1000),
  U("1606312619070-d48b4c652a52", 1000),
  U("1492446845049-9c50cc313f00", 1000),
];

// Editorial "about" panel image — real puff puff / pancake product shots
export const ABOUT_IMAGE = "/heroes/hero-1.jpg";
export const STORY_IMAGE = "/heroes/hero-2.jpg";

// Testimonial avatars
export const AVATARS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=70",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=70",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&q=70",
];

// Deterministic pick so a given product/category always shows the same photo.
function hashIndex(key: string, len: number): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return len ? h % len : 0;
}

export function productFallback(key: string): string {
  return PRODUCT_IMAGES[hashIndex(key, PRODUCT_IMAGES.length)];
}

export function categoryFallback(slug: string, key?: string): string {
  return (
    CATEGORY_IMAGES[slug] ||
    CATEGORY_DEFAULTS[hashIndex(key || slug, CATEGORY_DEFAULTS.length)]
  );
}

export function heroFallback(index = 0): string {
  return HERO_IMAGES[index % HERO_IMAGES.length];
}
