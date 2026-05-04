# Priority 8: Realtime Scope And Table Config

## Classification

`both (codebase + Supabase)`

## Priority

Do this after the main database egress reductions. Current screenshots show Realtime is not the primary usage problem, but it should remain controlled.

## Problem

Realtime can increase usage through messages and active connections. Broad subscriptions can also trigger UI refreshes that re-run database queries.

## Current Toycker Evidence

Realtime usage exists in:

- `src/modules/admin/components/realtime-orders-listener.tsx`
- `src/modules/admin/components/notifications/index.tsx`
- `src/modules/common/components/realtime-order-manager.tsx`

Example admin order listener:

```ts
event: "*",
schema: "public",
table: "orders"
```

The callback calls `router.refresh()`, which may trigger additional database reads.

## Recommended Fix

Codebase changes:

- Keep Realtime only on admin/order-specific screens.
- Replace `event: "*"` with the narrowest needed event where possible.
- Use filters when listening to a specific order.
- Avoid Realtime on public product browsing pages.
- Avoid refresh loops; refresh only when the event changes visible state.

Supabase changes:

- Confirm Realtime is enabled only for tables that need it.
- Likely allowed tables: `orders`, `admin_notifications`.
- Likely avoid Realtime for public static/catalog tables unless required: `products`, `categories`, `collections`, `home_banners`, `product_variants`.

## Expected Impact

- Keeps Realtime messages and connections low.
- Prevents Realtime-triggered database refresh amplification.
- Reduces risk of hitting Realtime Free Plan limits later.

## Risks / Notes

- Admin order screens may rely on broad events to stay current.
- Narrowing events must not hide important order status changes.
- Supabase table Realtime configuration should be checked before code assumes events are available.

## Acceptance Checks

- Admin receives new order/update notifications as expected.
- Order status page still updates when relevant order changes.
- Public storefront pages do not create Realtime subscriptions.
- Supabase Realtime tables list contains only intentional tables.

## References

- Supabase Realtime rate limits: https://supabase.com/docs/guides/realtime/rate-limits
- Supabase Realtime settings: https://supabase.com/docs/guides/realtime/settings
- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
