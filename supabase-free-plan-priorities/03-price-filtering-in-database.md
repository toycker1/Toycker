# Priority 3: Price Filtering In Database

## Classification

`both (codebase + Supabase)`

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

- Price min/max filters return the same visible product set as current behavior.
- Pagination works with price filters.
- Sorting still works.
- Product counts are accurate enough for the current UI.
- Query does not return full variants/options unless needed by the listing card.
- Supabase migration applies cleanly.

## References

- Supabase database advisors: https://supabase.com/docs/guides/database/database-advisors
- Supabase RLS performance recommendations: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
