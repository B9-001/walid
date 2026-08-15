-- ============================================================================
--  Per-product flavour options (Oreo / Lotus / Chocolate Sprinkle / …)
--  Run this in your Supabase project's SQL editor (Dashboard → SQL Editor)
--  after schema.sql. Safe to re-run.
--
--  Adds one column to diamond_products: a list of flavour names this product
--  is offered in. Empty list (the default) = this product has no flavour
--  choice, and the storefront shows no flavour picker for it — so every
--  existing product keeps behaving exactly as it does today.
--
--  The customer's pick is stored per cart line and lands in
--  diamond_orders.items[].flavor, which needs no schema change (items is
--  already jsonb).
-- ============================================================================

alter table diamond_products
  add column if not exists flavors jsonb not null default '[]'::jsonb;

comment on column diamond_products.flavors is
  'Flavour options offered for this product, e.g. ["Oreo","Lotus","Chocolate Sprinkle"]. Empty = no flavour choice shown.';
