# Priority 8: Realtime Scope And Table Config

## Classification

`both (codebase + Supabase)`

## Status

Completed and manually verified on 05 May 2026.

## Priority

Do this after the main database egress reductions. Current screenshots show Realtime is not the primary usage problem, but it should remain controlled.

## Problem

Realtime can increase usage through messages and active connections. Broad subscriptions can also trigger UI refreshes that re-run database queries.

## Current Toycker Evidence

Realtime usage exists in:

- `src/modules/admin/components/realtime-orders-listener.tsx`
- `src/modules/admin/components/notifications/index.tsx`
- `src/modules/common/components/realtime-order-manager.tsx`

Previous admin order listener:

```ts
event: "*",
schema: "public",
table: "orders"
```

The callback calls `router.refresh()`, which may trigger additional database reads.

Development and production Supabase verification after implementation:

- Migration `20260505170000_limit_realtime_publication_tables.sql` is applied in Toycker Development.
- Migration `20260505170000_limit_realtime_publication_tables.sql` is applied in production `toycker`.
- `supabase_realtime` contains only `public.admin_notifications` and `public.orders` in both projects.
- `public.wishlist_items` still exists in both projects as a normal table.

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

## Implemented Changes

Codebase changes:

- `src/modules/admin/components/realtime-orders-listener.tsx` now listens to `orders` `INSERT` and `UPDATE` only, instead of `event: "*"`.
- `src/modules/common/components/realtime-order-manager.tsx` remains scoped to `orders` `UPDATE` events for the current order id using `filter: id=eq.<orderId>`.
- `src/modules/admin/components/notifications/index.tsx` remains scoped to `admin_notifications` `INSERT` events only.
- The admin notification listener no longer uses `"postgres_changes" as any`.
- Realtime components now keep browser Supabase client creation stable across rerenders.

Supabase changes:

- Added migration `supabase/migrations/20260505170000_limit_realtime_publication_tables.sql`.
- The migration removes `public.wishlist_items` from the `supabase_realtime` publication if it is present.
- The migration does not create tables.
- The migration does not alter existing table columns.
- The migration does not insert, update, or delete data.
- The migration does not create or change RLS policies.

## Expected Impact

- Keeps Realtime messages and connections low.
- Prevents Realtime-triggered database refresh amplification.
- Reduces risk of hitting Realtime Free Plan limits later.

## Risks / Notes

- Admin order screens may rely on broad events to stay current.
- Narrowing events must not hide important order status changes.
- Supabase table Realtime configuration should be checked before code assumes events are available.
- Wishlist add/remove behavior should not be affected because the codebase does not subscribe to `wishlist_items` realtime events.
- Normal wishlist reads and writes still use standard Supabase queries.

## Acceptance Checks

- Admin receives new order/update notifications as expected.
- Order status page still updates when relevant order changes.
- Public storefront pages do not create Realtime subscriptions.
- Supabase Realtime tables list contains only intentional tables.

## Quality Checks

- `pnpm.cmd build` passed after rerunning with a longer timeout.
- `pnpm.cmd exec tsc --noEmit` is still blocked by the existing unrelated test error in `tests/lib/actions/complete-checkout.test.ts`.
- `pnpm.cmd lint` is still blocked by the existing project script issue where `next lint` reports `E:\Next.js_Projects\Toycker\lint` as an invalid project directory.
- No new `any` usage was added in the touched realtime files.

## Supabase Migration Verification

Development project:

- Project: `Toycker Development`
- Ref: `etvbyoquulyvxbrtzbpy`
- Backups created in `supabase/backups` before migration.
- Migration `20260505170000` applied and marked applied in migration history.
- Realtime publication after migration:
  - `public.admin_notifications`
  - `public.orders`
- `public.wishlist_items` table still exists.

Production project:

- Project: `toycker`
- Ref: `xhfasilbxjjxaqgxkann`
- Backups created in `supabase/prod/backups` before migration.
- Migration `20260505170000` applied and marked applied in migration history.
- Realtime publication after migration:
  - `public.admin_notifications`
  - `public.orders`
- `public.wishlist_items` table still exists.

## Manual Testing Completed

The following checks were completed before marking this priority manually verified:

- Confirm admin orders list refreshes after a new order or order update.
- Confirm admin order detail refreshes after same-order status changes.
- Confirm customer order tracking refreshes after same-order status changes.
- Confirm admin notifications still appear for new notifications.
- Confirm wishlist add/remove still works.
- Confirm public storefront browsing does not create product/category/collection/wishlist realtime subscriptions.

## References

- Supabase Realtime rate limits: https://supabase.com/docs/guides/realtime/rate-limits
- Supabase Realtime settings: https://supabase.com/docs/guides/realtime/settings
- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
