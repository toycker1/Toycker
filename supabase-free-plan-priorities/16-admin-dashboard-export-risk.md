# Remaining Risk: Admin Dashboard, Export, Import, And Backfill

## Classification

`code-only`

No Supabase migration is required now.

## Status

Completed and verified on 07 May 2026.

Priority 16 was implemented as a code-only optimization. The admin dashboard, admin product/order list pages, category/collection product selectors, product export/import, and visual-search backfill paths were reviewed and tightened so they do not return avoidable very-heavy Supabase responses.

No Supabase table, RLS policy, function, publication, or migration was changed for this priority.

## Why This Risk Remains

Admin pages are allowed to be heavier than public storefront pages because admin traffic is low. However, admin actions can still create large Supabase responses if used often.

Related files:

- `src/lib/data/admin.ts`
- `src/lib/data/analytics.ts`
- `src/app/admin/products/page.tsx`
- `src/app/admin/orders/page.tsx`
- `src/app/api/admin/products/export/route.ts`
- `src/app/api/admin/products/import/route.ts`
- `src/app/api/admin/search/backfill/route.ts`
- `src/modules/admin/components/settings/visual-search-settings.tsx`

## Current Evidence

Local code review found many admin `.select("*")` calls. This is less urgent than public storefront `.select("*")` because admin usage is private and lower volume.

Production evidence:

- product count is about `295`
- order count is about `51`
- review media count is `0`
- search analytics count is `0`

## Git History To Check First

Before changing admin list, export, import, or backfill behavior, inspect Git history for related admin and product data changes:

```powershell
git log --oneline -- src/lib/data/admin.ts src/lib/data/analytics.ts src/app/api/admin src/app/admin
git log --oneline -- supabase-free-plan-priorities
git show --stat <relevant-commit>
```

This is important because admin screens may intentionally use more fields than public storefront screens. Do not remove fields from admin forms or detail pages without checking why they were added.

So admin data volume is currently manageable.

## What Is Already Good

- Admin routes require authentication/admin checks.
- Public storefront optimizations are separate from admin workflows.
- Export/import/backfill are admin-only workflows.
- Admin product and order list pages now use explicit lightweight field lists.
- Admin category and collection product selectors now fetch only product option fields.
- Admin dashboard top-selling products now use a bounded recent-order sample and current lightweight product fields.
- Product export uses an explicit export field list and does not include technical heavy fields such as `search_vector` or `image_embedding`.
- Product import is guarded by CSV file type, file size, and row count limits.
- Visual-search backfill is manual, confirmed by the admin, batched, and returns only small status payloads.
- Build passes after the priority work.

## What Can Still Increase Egress

- Repeated admin dashboard refreshes.
- Exporting all products often.
- Running visual-search backfill repeatedly.
- Admin realtime refresh causing repeated server queries.
- Manual admin detail pages can still return fuller data because admins need those fields to edit or inspect a record.

## Recommended Action

Do not refactor all remaining admin detail code now. This is a prototype and admin traffic is low.

If admin usage grows:

1. Keep detail pages full only where the UI actually needs full edit/detail data.
2. Keep list pages light.
3. Add pagination to every admin list that can grow.
4. Keep product export behind an explicit admin action.
5. Add a clear warning before running visual-search backfill.
6. Avoid automatic backfill jobs.

## Implementation Trigger

Only implement this file if one of these is true:

- Admin routes appear in top egress logs.
- Product export is run frequently.
- Visual search backfill is run repeatedly.
- Admin list pages become slow after data grows.
- Admin realtime refresh causes repeated expensive server renders.

If admin traffic is low, no extra optimization is required beyond the completed work.

## What Was Implemented

1. Admin product listing and inventory listing now fetch only table/display fields:
   - product identity
   - image/thumbnail
   - current price/currency
   - stock/status
   - lightweight variant inventory data
2. Category and collection create/edit pages now use `getAdminProductOptions()` instead of loading full admin product rows.
3. Admin order listing now fetches only list fields and searches numeric display IDs in the database instead of fetching all orders and filtering in memory.
4. Dashboard top-selling products now:
   - reads only `items` from the latest valid orders
   - limits the sample to recent orders
   - aggregates only `product_id` and `quantity`
   - fetches current product display fields separately
   - shows current product price instead of customer purchase price
5. Product CSV export now uses explicit fields and avoids technical heavy fields:
   - not exported: `search_vector`, `image_embedding`, full `seo_metadata`
   - still exported intentionally: product descriptions, image URLs, variants, category/collection handles, because those are needed for CSV product management
6. Product CSV import now rejects non-CSV files, files over 5MB, and files over 1000 rows.
7. Visual-search backfill now stays manual, batched, and confirmation-based.

## Simple Implementation Plan If Admin List Pages Are Heavy

1. Identify the exact admin route causing traffic.
2. Inspect only the matching function in `src/lib/data/admin.ts`.
3. Replace `.select("*")` with explicit columns for that list page.
4. Keep full select for detail/edit pages if needed.
5. Confirm pagination is present.
6. Do not refactor unrelated admin modules.

Example distinction:

```txt
Admin product list:
id, name, handle, thumbnail, status, stock_count, created_at

Admin product detail/edit:
full product fields, variants, categories, collections, SEO fields
```

## Simple Implementation Plan If Export Is Heavy

1. Keep export behind admin auth.
2. Do not auto-run export.
3. Consider paged export only if product count becomes large.
4. Keep export fields explicit.
5. Do not add background infrastructure unless export size becomes a real blocker.

## Simple Implementation Plan If Backfill Is Heavy

1. Keep backfill manual.
2. Add a confirmation step if it is easy.
3. Process only missing embeddings.
4. Limit batch size if needed.
5. Do not run backfill during peak store traffic.

## How To Avoid Breaking Existing Functionality

- Admin detail/edit screens may need more data than admin list screens.
- Do not remove fields needed by forms.
- Do not change public storefront behavior while optimizing admin.
- Do not reduce order/customer data without checking the UI.

## What Not To Do

- Do not spend time optimizing rare admin-only screens before monitoring shows a problem.
- Do not remove data that admins need to manage orders/products.
- Do not run backfill repeatedly in production.

## Testing If Changed Later

1. Open admin dashboard.
2. Open admin products.
3. Open product detail/edit.
4. Export products once.
5. Open admin orders.
6. Open order detail.
7. Confirm all tables still show required columns.
8. Confirm public storefront is unaffected.

## Verification Completed

Quality checks after implementation:

- `pnpm.cmd build` passed.
- `git diff --check` passed.
- `pnpm.cmd exec tsc --noEmit --pretty false` still fails on the known unrelated test issue in `tests/lib/actions/complete-checkout.test.ts`.

Manual testing still recommended before production release:

1. Open `/admin`.
2. Confirm Top Selling Products shows only image, name, current price, and sold count.
3. Open `/admin/products` and `/admin/inventory`.
4. Confirm product tables still show required fields.
5. Open category and collection create/edit pages.
6. Confirm product selector options still appear.
7. Open `/admin/orders`.
8. Confirm order list and display ID search still work.
9. Export products once and confirm the CSV contains expected product-management fields.
10. Confirm storefront, cart, checkout, product detail, and visual search still work.

## References

- Supabase recommends checking frequent database queries and top API paths: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Supabase performance inspection: https://supabase.com/docs/guides/database/inspect
