-- ============================================================================
--  Diamond Taste — CRM / referral / analytics schema extensions
--  Run this in the Supabase SQL Editor AFTER schema.sql.
--
--  schema.sql only ships the "core" storefront tables. Several features that
--  are already fully built in the app code call database objects that were
--  never included in schema.sql:
--    - the pipeline/customer behaviour tracking used by the admin CRM tab
--      (app/admin/crm, components/diamond/admin/PipelineBoard.tsx,
--      CustomersTable.tsx, CustomerDetail.tsx, lib/track.ts)
--    - the referral program (app/refer, components/diamond/ReferProgram.tsx,
--      lib/referral.ts)
--    - the /control analytics dashboard (app/control, app/api/analytics)
--  This file adds exactly those objects. It is idempotent — safe to re-run.
--
--  NOT covered here (by design — see SETUP-GUIDE.md "Optional extras"): the
--  AI email broadcaster, sequence runner, and Instagram bot edge functions
--  (supabase/functions/diamond-ai-broadcast, diamond-sequence-runner,
--  diamond-crm-email, diamond-ig-bot, etc.) call additional tables
--  (diamond_ai_broadcasts, diamond_ai_learnings, diamond_bot_*,
--  diamond_email_sends/events/send_state/send_failures/unsubscribes,
--  diamond_sequence_steps) and RPCs (diamond_email_stats,
--  diamond_step_recipients, diamond_broadcast_recipients,
--  diamond_revive_stage_into_step, diamond_record_email_failure) that are
--  intentionally out of scope for this pass — they depend on an OpenRouter
--  API key and a fair amount of product decision-making (tier definitions,
--  playbook format, etc.) that belongs to whoever owns that feature.
-- ============================================================================

-- ── Customer pipeline & on-site behaviour tracking ──────────────────────────
alter table diamond_customers add column if not exists stage_locked boolean not null default false;
alter table diamond_customers add column if not exists stage_changed_at timestamptz;
alter table diamond_customers add column if not exists last_viewed_at timestamptz;
alter table diamond_customers add column if not exists last_viewed_product_id text;
alter table diamond_customers add column if not exists last_viewed_product_name text;
alter table diamond_customers add column if not exists last_added_at timestamptz;
alter table diamond_customers add column if not exists last_added_product_id text;
alter table diamond_customers add column if not exists last_added_product_name text;
alter table diamond_customers add column if not exists last_checkout_at timestamptz;

-- Recompute one customer's lifecycle stage from their paid-order history.
-- Thresholds match the descriptions in lib/segments.ts:
--   lead = 0 paid orders · new = 1 · repeat = 2-4 · vip = 5+ orders or ₦50k+ spent
--   at_risk = ordered before, none in 30+ days · lapsed = none in 60+ days
-- Recency (at_risk/lapsed) takes priority over vip/repeat so re-engagement
-- flows fire for anyone who's gone quiet, regardless of lifetime value.
create or replace function public.diamond_recompute_customer_stage(p_email text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_orders int;
  v_spent  bigint;
  v_last   date;
  v_stage  text;
begin
  select count(*), coalesce(sum(total_price), 0), max(created_at)::date
    into v_orders, v_spent, v_last
  from diamond_orders
  where lower(customer_email) = lower(p_email) and payment_status = 'paid';

  v_stage := case
    when v_orders = 0 then 'lead'
    when v_last <= current_date - 60 then 'lapsed'
    when v_last <= current_date - 30 then 'at_risk'
    when v_orders >= 5 or v_spent >= 5000000 then 'vip'
    when v_orders between 2 and 4 then 'repeat'
    else 'new'
  end;

  update diamond_customers
  set lifecycle_stage = v_stage,
      stage_changed_at = case when lifecycle_stage is distinct from v_stage then now() else stage_changed_at end
  where email = lower(p_email);
end;
$$;

-- Keeps diamond_customers.orders_count / total_spent / lifecycle_stage in
-- sync whenever an order is created or its status changes. Also creates a
-- diamond_customers row for guest checkouts that never signed up, and checks
-- whether this order just qualified a referrer for their reward.
create or replace function public.diamond_sync_customer_from_order()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_email       text := lower(NEW.customer_email);
  v_customer_id uuid;
  v_locked      boolean;
  v_prev_orders int;
  v_orders      int;
  v_spent       bigint;
begin
  if v_email is null or v_email = '' then
    return NEW;
  end if;

  insert into diamond_customers (email, full_name, phone, address, city, state)
  values (v_email, NEW.customer_name, NEW.customer_phone, NEW.customer_address, NEW.customer_city, NEW.customer_state)
  on conflict (email) do nothing;

  select id, orders_count, stage_locked into v_customer_id, v_prev_orders, v_locked
  from diamond_customers where email = v_email;

  select count(*), coalesce(sum(total_price), 0) into v_orders, v_spent
  from diamond_orders where lower(customer_email) = v_email and payment_status = 'paid';

  update diamond_customers
  set orders_count = v_orders, total_spent = v_spent
  where id = v_customer_id;

  if not v_locked then
    perform diamond_recompute_customer_stage(v_email);
  end if;

  -- Fires exactly once, the moment this customer's paid-order count crosses 0 -> 1+.
  if coalesce(v_prev_orders, 0) = 0 and v_orders >= 1 then
    perform diamond_check_referral_reward(v_customer_id);
  end if;

  return NEW;
end;
$$;

drop trigger if exists diamond_orders_sync_customer on diamond_orders;
create trigger diamond_orders_sync_customer
after insert or update of status, payment_status on diamond_orders
for each row execute function diamond_sync_customer_from_order();

-- Pulls in any customer who has ordered but never signed up, refreshes every
-- customer's orders_count/total_spent from diamond_orders, and re-runs the
-- stage recompute for everyone (skipping manually-pinned stages). Bound to
-- the "↺ Re-sync" button in the admin CRM tab.
create or replace function public.diamond_resync_crm()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_added int := 0;
  v_email text;
begin
  with missing as (
    insert into diamond_customers (email, full_name, phone, address, city, state)
    select distinct on (lower(o.customer_email))
      lower(o.customer_email), o.customer_name, o.customer_phone, o.customer_address, o.customer_city, o.customer_state
    from diamond_orders o
    where o.customer_email is not null and o.customer_email <> ''
    order by lower(o.customer_email), o.created_at desc
    on conflict (email) do nothing
    returning 1
  )
  select count(*) into v_added from missing;

  update diamond_customers c set
    orders_count = coalesce(agg.orders, 0),
    total_spent  = coalesce(agg.spent, 0)
  from (
    select lower(customer_email) as email, count(*) as orders, coalesce(sum(total_price), 0) as spent
    from diamond_orders where payment_status = 'paid'
    group by lower(customer_email)
  ) agg
  where agg.email = c.email;

  update diamond_customers c
  set orders_count = 0, total_spent = 0
  where not exists (
    select 1 from diamond_orders o
    where lower(o.customer_email) = c.email and o.payment_status = 'paid'
  ) and (c.orders_count <> 0 or c.total_spent <> 0);

  for v_email in select email from diamond_customers where not stage_locked loop
    perform diamond_recompute_customer_stage(v_email);
  end loop;

  return jsonb_build_object('added', v_added);
end;
$$;

-- ── Referral program ─────────────────────────────────────────────────────
-- One config row holding the referral goal (how many referred customers must
-- order before the referrer gets their reward). is_referral_reward = true
-- marks this row as config-only — checkout's validateCoupon() (lib/coupon.ts)
-- explicitly refuses to redeem a coupon with is_referral_reward = true, so
-- this row itself can never be used at checkout.
insert into diamond_coupons (code, description, discount_type, discount_value, is_active, is_public, is_referral_reward, referral_goal, stackable)
select 'REFERRAL-GOAL-CONFIG', 'Config only — holds the referral goal. Not a redeemable code.', 'percentage', 100, true, false, true, 3, false
where not exists (select 1 from diamond_coupons where is_referral_reward = true);

-- Attaches a visitor to the referrer whose link they arrived with. Safe to
-- call repeatedly: only ever sets referred_by once, and never to yourself.
create or replace function public.diamond_attribute_referral(p_email text, p_self uuid, p_ref text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_referrer_id uuid;
begin
  select id into v_referrer_id from diamond_customers where referral_code = upper(p_ref);
  if v_referrer_id is null then
    return;
  end if;
  if p_self is not null and v_referrer_id = (select id from diamond_customers where user_id = p_self) then
    return; -- can't refer yourself
  end if;

  update diamond_customers
  set referred_by = v_referrer_id
  where email = lower(p_email) and referred_by is null and id <> v_referrer_id;
end;
$$;

-- Count of this referrer's referred customers who have placed a paid order.
create or replace function public.diamond_referral_progress(p_referrer uuid)
returns int
language sql
stable
security definer set search_path = public
as $$
  select count(*)::int
  from diamond_customers c
  join diamond_customers r on r.id = c.referred_by
  where r.user_id = p_referrer and c.orders_count >= 1;
$$;

-- Grants the referrer a personal, one-time-use "free milk cake" coupon once
-- enough of their referred customers have placed a paid order. Called from
-- diamond_sync_customer_from_order() the moment a referred customer's order
-- count crosses 0 -> 1. is_referral_reward is FALSE on the granted coupon
-- (unlike the config row above) so it's actually redeemable at checkout —
-- owner_user_id restricts it to this referrer only (see lib/coupon.ts).
create or replace function public.diamond_check_referral_reward(p_customer_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_referred_by uuid;
  v_referrer    diamond_customers%rowtype;
  v_goal        int;
  v_qualified   int;
  v_code        text;
begin
  select referred_by into v_referred_by from diamond_customers where id = p_customer_id;
  if v_referred_by is null then
    return;
  end if;

  select * into v_referrer from diamond_customers where id = v_referred_by;
  if not found or v_referrer.referral_reward_given or v_referrer.user_id is null then
    return;
  end if;

  select coalesce(max(referral_goal), 3) into v_goal from diamond_coupons where is_referral_reward = true;

  select count(*) into v_qualified
  from diamond_customers where referred_by = v_referrer.id and orders_count >= 1;

  if v_qualified >= v_goal then
    v_code := 'REFER' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    insert into diamond_coupons
      (code, description, discount_type, discount_value, is_active, is_public, owner_user_id, is_referral_reward, referral_goal, stackable)
    values
      (v_code, 'Referral reward — free milk cake', 'percentage', 100, true, false, v_referrer.user_id, false, v_goal, false);

    update diamond_customers set referral_reward_given = true where id = v_referrer.id;
  end if;
end;
$$;

-- ── /control analytics dashboard ────────────────────────────────────────────
-- Powers app/api/analytics/route.ts, called with the CONTROL_PASSWORD-gated
-- service-role client. Reads only diamond_analytics_events (lib/analytics.ts)
-- and diamond_orders — nothing customer-identifying is returned.
create or replace function public.diamond_analytics_summary(p_days int default 7)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_since  timestamptz := now() - (p_days || ' days')::interval;
  v_result jsonb;
begin
  select jsonb_build_object(
    'range_days', p_days,
    'visitors', (select count(distinct session_id) from diamond_analytics_events where created_at >= v_since),
    'page_views', (select count(*) from diamond_analytics_events where created_at >= v_since and event_type = 'page_view'),
    'clicks', (select count(*) from diamond_analytics_events where created_at >= v_since and event_type = 'click'),
    'product_views', (select count(*) from diamond_analytics_events where created_at >= v_since and event_type = 'view_product'),
    'add_to_carts', (select count(*) from diamond_analytics_events where created_at >= v_since and event_type = 'add_to_cart'),
    'sessions_with_atc', (select count(distinct session_id) from diamond_analytics_events where created_at >= v_since and event_type = 'add_to_cart'),
    'top_pages', coalesce((
      select jsonb_agg(t) from (
        select path, count(*) as views
        from diamond_analytics_events
        where created_at >= v_since and event_type = 'page_view' and path is not null
        group by path order by views desc limit 15
      ) t
    ), '[]'::jsonb),
    'top_clicks', coalesce((
      select jsonb_agg(t) from (
        select label, count(*) as clicks
        from diamond_analytics_events
        where created_at >= v_since and event_type = 'click' and label is not null
        group by label order by clicks desc limit 15
      ) t
    ), '[]'::jsonb),
    'exits', coalesce((
      select jsonb_agg(t) from (
        select path, count(*) as exits, round(avg(duration_ms) / 1000.0)::int as avg_seconds
        from diamond_analytics_events
        where created_at >= v_since and event_type = 'exit' and path is not null
        group by path order by exits desc limit 15
      ) t
    ), '[]'::jsonb),
    'by_day', coalesce((
      select jsonb_agg(t) from (
        select to_char(d.day, 'YYYY-MM-DD') as day,
               count(distinct e.session_id) as visitors,
               count(*) filter (where e.event_type = 'page_view') as views
        from generate_series(date_trunc('day', v_since), date_trunc('day', now()), interval '1 day') d(day)
        left join diamond_analytics_events e on date_trunc('day', e.created_at) = d.day
        group by d.day order by d.day
      ) t
    ), '[]'::jsonb),
    'orders', (select count(*) from diamond_orders where payment_status = 'paid' and created_at >= v_since),
    'revenue', (select coalesce(sum(total_price), 0) from diamond_orders where payment_status = 'paid' and created_at >= v_since)
  ) into v_result;

  return v_result;
end;
$$;
