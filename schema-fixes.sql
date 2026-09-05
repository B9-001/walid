-- ============================================================================
--  Bug fixes that live in the database rather than in application code.
--  Run after schema.sql / schema-flavors.sql / schema-crm-extensions.sql.
--  Safe to re-run.
--
--  Everything below is ALREADY APPLIED to project mlixtbyhsltflysatsib.
--  This file exists so a fresh project — or anyone reading the repo — gets
--  the same behaviour, and so the reasoning isn't stranded in migration
--  history.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Stock was never actually decremented.
--
-- Both diamond-paystack-webhook and the IG bot README said "stock is
-- decremented by a DB trigger on insert", but no such trigger existed and no
-- application code ever wrote stock_level — it was only ever read. Live proof:
-- mini-box-box-of-9-puff-puff had 13 units sold with stock_level still sitting
-- at 100, so "Sold out" could never fire and the cart's stock checks were
-- comparing against a number that never moved.
--
-- This adds the trigger the code always assumed was there. It aggregates the
-- order's items jsonb (so two lines of the same product in different flavours
-- both count) and floors at zero. Products with stock_level null are untracked
-- and left alone.
-- ---------------------------------------------------------------------------

create or replace function diamond_decrement_stock_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update diamond_products p
  set stock_level = greatest(0, p.stock_level - agg.qty)
  from (
    select
      item->>'product_id'                      as product_id,
      sum(coalesce((item->>'quantity')::int, 1)) as qty
    from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) as item
    where item->>'product_id' is not null
    group by 1
  ) as agg
  where p.product_id = agg.product_id
    and p.stock_level is not null;   -- null = untracked / unlimited

  return new;
exception when others then
  -- Stock bookkeeping must never roll back a paid order.
  raise warning 'diamond_decrement_stock_from_order failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists diamond_orders_decrement_stock on diamond_orders;
create trigger diamond_orders_decrement_stock
after insert on diamond_orders
for each row
execute function diamond_decrement_stock_from_order();


-- ---------------------------------------------------------------------------
-- 2. Backup tables were world-readable, and SECURITY DEFINER trigger
--    functions were callable by anyone.
--
-- diamond_customers_backup / diamond_orders_backup were created during the
-- CRM cleanup and shipped with RLS disabled, which left customer names,
-- emails, phone numbers and delivery addresses readable AND writable by
-- anybody holding the anon key (which ships in the browser bundle).
--
-- Enabling RLS with no policies denies anon and authenticated outright; the
-- service role bypasses RLS, so admin tooling is unaffected. Drop these tables
-- entirely once you're sure you no longer need the pre-cleanup data.
--
-- The trigger functions below are SECURITY DEFINER, so leaving EXECUTE
-- granted let a caller invoke them directly with a forged NEW record.
-- Triggers run as the table owner and don't need the grant.
--
-- Note the revoke has to name `public` as well as anon/authenticated: Postgres
-- grants EXECUTE to PUBLIC on every new function by default, and revoking from
-- anon alone leaves that blanket grant (proacl `=X/postgres`) in place, so the
-- functions stay callable by everyone.
-- ---------------------------------------------------------------------------

alter table if exists diamond_customers_backup enable row level security;
alter table if exists diamond_orders_backup    enable row level security;

revoke execute on function diamond_decrement_stock_from_order() from public, anon, authenticated;
revoke execute on function diamond_notify_order_status()        from public, anon, authenticated;
revoke execute on function diamond_sync_customer_from_order()   from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. Coupon usage counting had a lost-update race.
--
-- lib/coupon.ts used to SELECT usage_count and then UPDATE it to value + 1.
-- Two customers redeeming the same single-use voucher at the same moment both
-- read the same count and both wrote the same number, so usage_count fell
-- behind reality and a usage_limit of 1 could be redeemed repeatedly.
--
-- Doing the increment inside a single UPDATE makes concurrent redemptions
-- serialise on the row instead of clobbering each other.
-- ---------------------------------------------------------------------------

create or replace function diamond_increment_coupon_usage(p_coupon_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update diamond_coupons
  set usage_count = coalesce(usage_count, 0) + 1
  where id = p_coupon_id
  returning usage_count;
$$;

grant execute on function diamond_increment_coupon_usage(uuid) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4. Deployed edge functions were writing to tables that didn't exist.
--
-- Six tables referenced by ACTIVE, publicly-reachable edge functions had no
-- definition anywhere — not in schema.sql, not in schema-crm-extensions.sql,
-- not in the database:
--
--   diamond-resend-webhook  -> diamond_email_events, diamond_email_unsubscribes
--   diamond-unsubscribe     -> diamond_email_unsubscribes
--   diamond-ig-bot          -> diamond_bot_sessions, diamond_bot_messages,
--                              diamond_bot_payments, diamond_bot_complaints
--
-- So every Resend delivery/open/click/bounce event was dropped, every
-- unsubscribe click silently did nothing (the page still said "You've been
-- unsubscribed"), and the Instagram bot could not hold a conversation.
--
-- Columns below are taken from what those functions actually insert.
-- ---------------------------------------------------------------------------

create table if not exists diamond_email_unsubscribes (
  email      text primary key,
  created_at timestamptz not null default now()
);

create table if not exists diamond_email_events (
  id          bigserial primary key,
  resend_id   text,
  email       text,
  type        text not null,
  url         text,
  occurred_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (resend_id, type, occurred_at)   -- webhook retries are idempotent
);
create index if not exists diamond_email_events_resend_id_idx on diamond_email_events (resend_id);
create index if not exists diamond_email_events_email_idx     on diamond_email_events (email);

create table if not exists diamond_bot_sessions (
  sender_id        text primary key,
  state            text not null default 'menu',
  cart             jsonb not null default '[]'::jsonb,
  draft            jsonb not null default '{}'::jsonb,
  handoff          boolean not null default false,
  handoff_at       timestamptz,
  last_prompt      text,
  saved_details    jsonb,
  last_activity_at timestamptz not null default now(),
  last_followup_at timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists diamond_bot_messages (
  id         bigserial primary key,
  sender_id  text not null,
  direction  text not null,
  type       text,
  content    text,
  raw        jsonb,
  created_at timestamptz not null default now()
);
create index if not exists diamond_bot_messages_sender_idx on diamond_bot_messages (sender_id, created_at desc);

create table if not exists diamond_bot_payments (
  id              bigserial primary key,
  sender_id       text not null,
  reference       text not null unique,
  cart            jsonb not null default '[]'::jsonb,
  delivery_method text not null default 'pickup',
  delivery_fee    integer not null default 0,
  service_fee     integer not null default 0,
  area            text,
  created_at      timestamptz not null default now()
);

create table if not exists diamond_bot_complaints (
  id           bigserial primary key,
  sender_id    text not null,
  order_number text,
  message      text,
  created_at   timestamptz not null default now()
);

-- All six hold customer PII or are written only by service-role edge functions.
-- RLS on with no policies = anon and authenticated are denied outright; the
-- service role bypasses RLS, so the edge functions are unaffected.
alter table diamond_email_unsubscribes enable row level security;
alter table diamond_email_events       enable row level security;
alter table diamond_bot_sessions       enable row level security;
alter table diamond_bot_messages       enable row level security;
alter table diamond_bot_payments       enable row level security;
alter table diamond_bot_complaints     enable row level security;


-- ---------------------------------------------------------------------------
-- STILL MISSING — the email-marketing subsystem is not built.
--
-- These four objects have no definition in this repo or the database:
--   diamond_sequence_steps, diamond_email_sends,
--   diamond_email_send_state, diamond_email_send_failures  (tables)
--   diamond_record_email_failure, diamond_email_stats,
--   diamond_step_recipients, diamond_broadcast_recipients  (functions)
--
-- Nothing is currently broken by their absence: the functions that need them
-- (diamond-sequence-runner, diamond-broadcast-email, diamond-generate-sequence)
-- are NOT deployed, and components/diamond/admin/EmailStats.tsx — which calls
-- three of those RPCs — is not imported by any page.
--
-- Building that subsystem out is a feature, not a bug fix, so it is left
-- alone here. Deploy the runner only after creating these.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 5. Admin-only RPCs were callable with the public anon key.
--
-- Postgres grants EXECUTE to PUBLIC on every new function, so these
-- SECURITY DEFINER functions were reachable by anyone at
-- /rest/v1/rpc/<name> using the anon key that ships in the browser bundle.
--
-- The worst of them was diamond_analytics_summary: it returns order counts
-- and revenue, and is only ever called from /api/analytics, which uses the
-- service role and is password-gated. Nothing legitimate ever called it as
-- anon.
-- ---------------------------------------------------------------------------

revoke execute on function diamond_analytics_summary(int) from public, anon, authenticated;

-- Admin-dashboard-only writes. The admin is signed in, so `authenticated`
-- keeps them working; anon has no business triggering a full CRM resync or a
-- customer stage recompute.
revoke execute on function diamond_resync_crm()                   from public, anon;
revoke execute on function diamond_recompute_customer_stage(text) from public, anon;

-- Not called by any application or edge-function code. Trigger functions that
-- call them internally run as owner, so this doesn't break those paths.
revoke execute on function diamond_check_referral_reward(uuid) from public, anon, authenticated;
revoke execute on function diamond_referral_progress(uuid)     from public, anon, authenticated;

-- diamond_product_sales genuinely needs anon — the storefront ranks products
-- by units sold from the browser — so it keeps EXECUTE. It just needed its
-- search_path pinned like every other SECURITY DEFINER function here.
alter function diamond_product_sales() set search_path = public;
