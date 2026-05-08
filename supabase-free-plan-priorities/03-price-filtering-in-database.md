# Priority 3: Price Filtering In Database

## Classification

`both (codebase + Supabase)`

## Status

Completed and manually verified on 05 May 2026.

## Priority

Do this after the first code-only product query improvements, unless price-filtered browsing is a major traffic source.

## Problem

Price filtering currently needs variant-aware price logic. The app handles this by fetching products and filtering in application code when a price filter is active.

That is bad for egress because Supabase sends products that may never be shown to the user.

## Current Toycker Evidence

In `src/lib/data/products.ts`, price filtering is documented as client-side:

```ts
// NOTE: Price filtering is done CLIENT-SIDE after fetching
// because we need to filter by variant prices, not just product.price
```

When `priceFilter` is active, pagination is skipped until after filtering:

```ts
const { data, count, error } = needsClientSideFiltering
  ? await query
  : await query.range(offset, offset + limit - 1)
```

Then the code calculates display price from product variants.

## Recommended Fix

Move variant-aware price filtering into Supabase.

Recommended Supabase-side option:

- Add a SQL view or RPC function that exposes a listing-safe product row with `display_price` or `min_variant_price`.
- Apply `min_price`, `max_price`, category, collection, availability, search, sort, offset, and limit inside SQL.
- Add indexes where needed for active status, category join, collection join, and price/sort fields.

Recommended codebase-side option:

- Update `listPaginatedProducts` to call the view/RPC when price filtering is active.
- Stop fetching all products for price filtering.
- Return the same response shape expected by existing product listing UI.

## Implementation Completed

Priority 3 was implemented with a Supabase migration and a focused codebase change.

Migration file:

```txt
supabase/migrations/20260505133000_storefront_price_filtered_products.sql
```

The migration:

- Creates the `public.list_storefront_products_by_price` RPC function.
- Adds the `idx_product_variants_product_id_price` index on `product_variants(product_id, price)`.
- Does not create new tables.
- Does not change existing table columns.
- Does not modify existing product, variant, category, or collection data.

The RPC uses existing tables:

- `products`
- `product_variants`
- `product_categories`
- `product_collections`

The RPC applies these rules inside Supabase:

- Active products only.
- Display price is the cheapest variant price when variants exist, otherwise `products.price`.
- Excludes zero display-price products when a price filter is active.
- Applies min price and max price in SQL.
- Applies category, collection, product id, search, availability, sort, offset, and limit in SQL.
- Returns only listing-safe product-card fields and lightweight variant fields.
- Returns `total_count` for the filtered result set.

Codebase change:

- `src/lib/data/products.ts` now calls `list_storefront_products_by_price` only when a price filter is active.
- Normal product listing without a price filter still uses the existing lightweight Supabase query.
- Product detail and quick-view detail flows still use the existing detail query.
- The old app-side scan/filter/slice price-filter logic was removed.

Supabase Development project update:

- The migration was applied to the linked `Toycker Development` project on 05 May 2026.
- Backups were created before applying it in `supabase/backups`.
- The RPC and index were verified after migration.
- A smoke test returned valid price-filtered products with `display_price` and `total_count`.

## Expected Impact

- Major egress reduction for price-filtered browsing.
- More predictable product listing response sizes.
- Better performance as product count grows.

## Risks / Notes

- SQL must match the current product price display rules.
- If product cards need club discounts or payment discounts, keep those calculations separate unless they are already database-backed.
- RLS/security must be reviewed if a new view or RPC is exposed to the anon role.
- This should be implemented through a migration, not manually only in the Supabase dashboard.

## Acceptance Checks

- Passed: Price min/max filters return the expected visible product set.
- Passed: Pagination works with price filters.
- Passed: Sorting works with price filters.
- Passed: Search and availability filters work together with price filters.
- Passed: Product detail navigation from filtered results still works.
- Passed: Existing storefront, cart, checkout, auth, wishlist, search, and admin smoke workflows still work.
- Passed: Query returns page-sized listing results instead of scanning/filtering a larger app-side product list.
- Passed: Supabase migration applied cleanly to the development project.

## Quality Checks

- `pnpm.cmd build`: Passed.
- `pnpm.cmd exec tsc --noEmit`: Blocked by an existing unrelated test issue in `tests/lib/actions/complete-checkout.test.ts`.
- `pnpm.cmd lint`: Blocked by the existing project lint script issue where `next lint` is interpreted as an invalid `lint` project path.
- No new TypeScript `any` usage was added in the touched implementation files.

## Manual Verification Evidence

Manual testing completed on 05 May 2026.

Verified workflows:

- Store page loads normally without price filters.
- Min-only price filter works.
- Max-only price filter works.
- Min and max price filter works.
- Pagination works while price filter is active.
- Sorting works while price filter is active.
- Price filter works with search.
- Price filter works with availability.
- Filtered product detail page opens correctly.
- Existing storefront flows still work.
- Existing admin product list/edit-page smoke test still works.

## References

- Supabase database advisors: https://supabase.com/docs/guides/database/database-advisors
- Supabase RLS performance recommendations: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
