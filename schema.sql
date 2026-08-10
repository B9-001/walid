-- ============================================================================
--  Diamond Taste template — core database schema
--  Run this in your Supabase project's SQL editor (Dashboard → SQL Editor).
--  It creates the tables the storefront + admin need, with permissive RLS so
--  the public anon key can read the store and save orders.
--
--  Money is stored in KOBO (₦ × 100) as integers everywhere.
--  All tables are prefixed `diamond_` — rename the prefix if you like, but then
--  update the table names in the app code to match.
-- ============================================================================

-- Categories ----------------------------------------------------------------
create table if not exists diamond_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  image_url   text,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- Products ------------------------------------------------------------------
create table if not exists diamond_products (
  id                  uuid primary key default gen_random_uuid(),
  product_id          text not null unique,          -- url slug
  name                text not null,
  description         text,
  category            text not null,                 -- matches diamond_categories.name
  image_url           text,
  images              jsonb default '[]'::jsonb,      -- extra gallery images
  base_price          integer not null default 0,     -- kobo (used when no size tiers)
  old_price           integer,                        -- kobo, struck-through sale price
  sizes               jsonb default '[]'::jsonb,      -- [{label, price, serves}] price in kobo
  featured            boolean default false,
  active              boolean default true,
  stock_level         integer,                         -- null = unlimited; 0 = sold out
  preorder            boolean not null default false,
  preorder_release_at timestamptz,
  created_at          timestamptz default now()
);

-- Orders --------------------------------------------------------------------
create table if not exists diamond_orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text not null unique,             -- customer-facing code e.g. DT-XXXXXX
  customer_id       uuid,                             -- set when a signed-in customer orders
  customer_name     text not null,
  customer_email    text not null,
  customer_phone    text,
  customer_address  text,
  customer_city     text,
  customer_state    text,
  delivery_method   text default 'delivery',          -- 'delivery' | 'pickup'
  delivery_fee      integer default 0,                -- kobo
  service_fee       integer not null default 0,        -- kobo
  required_date     date,
  required_time     text,
  items             jsonb not null default '[]'::jsonb,
  subtotal          integer not null default 0,        -- kobo
  coupon_code       text,
  coupon_discount   integer default 0,                -- kobo
  total_price       integer not null default 0,        -- kobo
  status            text not null default 'pending',   -- pending|confirmed|baking|ready|completed|cancelled
  payment_status    text not null default 'pending',   -- pending|paid|failed
  payment_reference text unique,
  notes             text,
  referral_source   text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
create index if not exists diamond_orders_status_idx  on diamond_orders (status);
create index if not exists diamond_orders_created_idx on diamond_orders (created_at desc);

-- Coupons -------------------------------------------------------------------
create table if not exists diamond_coupons (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  description         text,
  discount_type       text not null default 'percentage',  -- 'percentage' | 'fixed'
  discount_value      numeric not null default 0,           -- percent (0-100) or kobo
  min_order_amount    integer default 0,                    -- kobo
  max_discount_amount integer,                              -- kobo cap for percentage
  usage_limit         integer,
  usage_count         integer default 0,
  expiry_date         date,
  is_active           boolean default true,
  first_order_only    boolean not null default false,
  is_public           boolean not null default true,        -- show in the cart's voucher list
  category            text,                                  -- restrict to one product category
  owner_user_id       uuid,                                  -- personal coupon (referral reward)
  is_referral_reward  boolean not null default false,
  referral_goal       integer,
  stackable           boolean not null default true,
  created_at          timestamptz default now()
);

-- Hero slides ---------------------------------------------------------------
create table if not exists diamond_hero_images (
  id          uuid primary key default gen_random_uuid(),
  image_url   text not null,
  heading     text,
  subheading  text,
  order_index integer default 0,
  created_at  timestamptz default now()
);

-- Site settings (single row) ------------------------------------------------
create table if not exists diamond_site_settings (
  id                      uuid primary key default gen_random_uuid(),
  delivery_fee            integer default 0,     -- kobo, default delivery fee
  free_delivery_threshold integer,               -- kobo, free delivery above this
  contact_phone           text,
  contact_email           text,
  whatsapp_number         text,
  instagram_handle        text,
  pickup_address          text,
  announcement            text,
  business_hours          jsonb,
  created_at              timestamptz default now()
);

-- Delivery fees (per-area, managed from the admin) --------------------------
create table if not exists diamond_delivery_fees (
  id          uuid primary key default gen_random_uuid(),
  location    text not null,
  fee         integer not null default 0,   -- kobo
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz default now()
);

-- Customers & leads (storefront shoppers, NOT admins) -----------------------
create table if not exists diamond_customers (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid,                         -- null = guest lead; set once they sign up
  email                 text not null unique,
  full_name             text,
  phone                 text,
  avatar_url            text,
  address               text,
  city                  text,
  state                 text,
  delivery_area         text,
  referral_code         text unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  referred_by           uuid,
  referral_reward_given boolean not null default false,
  lifecycle_stage       text not null default 'lead',
  orders_count          integer not null default 0,
  total_spent           bigint not null default 0,
  referral_source       text,
  created_at            timestamptz default now(),
  last_seen_at          timestamptz default now()
);
create unique index if not exists diamond_customers_user_id_key on diamond_customers(user_id) where user_id is not null;

-- Admin allowlist (source of truth for who can access /admin) ----------------
-- A user can enter /admin ONLY if their auth.users id is in this table.
create table if not exists diamond_admins (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz default now()
);

-- Lightweight analytics events (optional; written by the storefront) ---------
create table if not exists diamond_analytics_events (
  id         bigint generated by default as identity primary key,
  session_id text not null,
  event_type text not null,
  path text, label text, href text, referrer text,
  value integer, duration_ms integer, device text, user_agent text,
  created_at timestamptz default now() not null
);

-- Email log (optional; written by the order-email edge function) -------------
create table if not exists diamond_email_log (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid,
  email       text not null,
  subject     text,
  type        text not null default 'other',
  resend_id   text,
  sent_at     timestamptz default now() not null
);

-- Permissive RLS (public anon key can read the store + insert orders) --------
do $$
declare t text;
begin
  foreach t in array array[
    'diamond_categories','diamond_products','diamond_orders','diamond_coupons',
    'diamond_hero_images','diamond_site_settings','diamond_delivery_fees',
    'diamond_customers','diamond_admins','diamond_analytics_events','diamond_email_log'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I_all on %I;', t, t);
    execute format('create policy %I_all on %I for all using (true) with check (true);', t, t);
  end loop;
end $$;

-- RPCs the storefront calls -------------------------------------------------
-- Best-sellers ranking: units sold per product across non-cancelled orders.
create or replace function public.diamond_product_sales()
 returns table(product_id text, sold bigint)
 language sql stable security definer
as $$
  select it->>'product_id' as product_id, sum((it->>'quantity')::numeric)::bigint as sold
  from diamond_orders o, jsonb_array_elements(o.items) it
  where coalesce(lower(o.status),'') not in ('cancelled','canceled','refunded','failed')
    and it->>'product_id' is not null
  group by 1
$$;

-- Look up whether an email already has an account (used at checkout).
create or replace function public.diamond_lookup_customer(p_email text)
 returns table(found boolean, has_account boolean, full_name text)
 language sql stable security definer set search_path to 'public'
as $$
  select true, (c.user_id is not null), c.full_name
  from diamond_customers c where c.email = lower(p_email) limit 1;
$$;

-- Seed a single settings row so the storefront has something to read.
insert into diamond_site_settings (delivery_fee, free_delivery_threshold, announcement)
values (0, 2000000, 'Welcome!')
on conflict do nothing;

-- ============================================================================
--  STORAGE: after running this, create two PUBLIC buckets in
--  Dashboard → Storage:   diamond-products   and   diamond-hero
--  (see SETUP-GUIDE.md, step 3, for the exact steps + upload policies)
-- ============================================================================
