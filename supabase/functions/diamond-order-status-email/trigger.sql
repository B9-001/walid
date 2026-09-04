-- DB trigger that powers diamond-order-status-email.
-- Fires on every diamond_orders.status change (website + chatbot orders) and POSTs
-- the order_number + new status to the edge function, which emails the customer.
--
-- APPLIED to project mlixtbyhsltflysatsib as migration
-- `diamond_order_status_email_trigger`. Verified end to end: pg_net delivers the
-- request and the function responds (404 "order not found" for a bogus order
-- number, rather than 401), so the auth header is being accepted.
--
-- Before running this anywhere else, replace BOTH placeholders below:
--   <PROJECT_REF>  — your Supabase project ref
--   <ANON_KEY>     — the project's anon/publishable key (Settings → API).
--                    Not a secret: it's the same key that ships in the browser
--                    bundle. It's kept out of this file only to avoid handing
--                    scrapers a free copy from a public repo.
--
-- Two bugs the original version of this file had, both fixed here:
--   1. It shipped with a literal YOUR_SUPABASE_PROJECT_REF placeholder and was
--      never actually applied, so status emails silently never fired.
--   2. It sent no Authorization header. diamond-order-status-email is deployed
--      with verify_jwt = true, so every call would have been rejected 401 even
--      once the trigger existed.

create extension if not exists pg_net;

create or replace function diamond_notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
begin
  -- Fire-and-forget: pg_net queues the request, so the admin's status update
  -- never waits on the email.
  perform net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/diamond-order-status-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body := jsonb_build_object('order_number', new.order_number, 'status', new.status)
  );
  return new;
exception when others then
  -- An email problem must never block the shop owner from updating an order.
  raise warning 'diamond_notify_order_status failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists diamond_order_status_email on diamond_orders;
create trigger diamond_order_status_email
after update on diamond_orders
for each row
when (old.status is distinct from new.status)
execute function diamond_notify_order_status();

-- Check it landed:
--   select tgname from pg_trigger where tgname = 'diamond_order_status_email';
-- Inspect recent deliveries:
--   select id, status_code, content, error_msg, created
--   from net._http_response order by created desc limit 10;
