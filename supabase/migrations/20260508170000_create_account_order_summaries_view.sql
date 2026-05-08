-- Lightweight account order summaries for customer account pages.
-- This does not create any table and does not change existing table columns.
-- It exposes only the small fields needed for order lists, plus the first item
-- title/thumbnail and item count from the existing orders.items JSONB snapshot.

drop view if exists public.account_order_summaries;

create view public.account_order_summaries
with (security_invoker = true) as
select
  o.id,
  o.user_id,
  o.display_id,
  o.created_at,
  o.status,
  o.fulfillment_status,
  o.payment_status,
  o.total,
  o.total_amount,
  o.currency_code,
  coalesce(
    nullif(o.items -> 0 ->> 'product_title', ''),
    nullif(o.items -> 0 ->> 'title', ''),
    'Order items'
  ) as first_item_title,
  nullif(o.items -> 0 ->> 'thumbnail', '') as first_item_thumbnail,
  case
    when jsonb_typeof(o.items) = 'array' then jsonb_array_length(o.items)
    else 0
  end as item_count
from public.orders o;

comment on view public.account_order_summaries is
  'Lightweight customer account order list projection. Uses security_invoker so existing orders RLS is respected.';
