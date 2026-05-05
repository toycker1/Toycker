# Remaining Risk: Admin Dashboard, Export, Import, And Backfill

## Classification

`code-only`

No Supabase migration is required now.

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
- Build passes after the priority work.

## What Can Still Increase Egress

- Repeated admin dashboard refreshes.
- Exporting all products often.
- Running visual-search backfill repeatedly.
- Admin list pages returning full rows when only table columns are shown.
- Admin realtime refresh causing repeated server queries.

## Recommended Action

Do not refactor all admin code now. This is a prototype and admin traffic is low.

If admin usage grows:

1. Replace admin list `.select("*")` with table-specific field lists.
2. Keep detail pages full, list pages light.
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

If admin traffic is low, do not optimize this yet.

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

## References

- Supabase recommends checking frequent database queries and top API paths: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Supabase performance inspection: https://supabase.com/docs/guides/database/inspect
