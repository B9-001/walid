-- DB trigger that powers diamond-order-status-email.
-- Applied to project YOUR_SUPABASE_PROJECT_REF (migration: diamond_order_status_email_trigger).
-- Fires on every diamond_orders.status change (website + chatbot orders) and POSTs
-- the order_number + new status to the edge function, which emails the customer.

create extension if not exists pg_net;

create or replace function diamond_notify_order_status() returns trigger as $$
begin
  perform net.http_post(
    url := 'https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/diamond-order-status-email',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('order_number', NEW.order_number, 'status', NEW.status)
  );
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists diamond_order_status_email on diamond_orders;
create trigger diamond_order_status_email
after update on diamond_orders
for each row
when (OLD.status is distinct from NEW.status)
execute function diamond_notify_order_status();
