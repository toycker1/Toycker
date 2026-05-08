# Priority 2: Database-Level Pagination

## Classification

`code-only`

## Priority

Do this immediately after lightweight product listing queries.

## Status

`completed`

- Completed on: 04 May 2026
- Manual testing status: passed
- Implementation type: `code-only`
- Supabase migration required: no
- Supabase dashboard/config change required: no

## Problem

Pagination must happen before Supabase sends data back. If the app fetches many rows and then slices them in JavaScript, Supabase egress still includes all fetched rows.

For Free Plan usage, the important rule is:

> Supabase should return only the rows that the user can actually see.

## Current Toycker Evidence

In `src/lib/data/products.ts`, `listPaginatedProducts` usually applies:

```ts
query.range(offset, offset + limit - 1)
```

But when price filtering is active:

```ts
const needsClientSideFiltering = priceFilter?.min !== undefined || priceFilter?.max !== undefined

const { data, count, error } = needsClientSideFiltering
  ? await query
  : await query.range(offset, offset + limit - 1)
```

That means price-filtered pages may fetch all matching rows before pagination.

## Recommended Fix

For code-only first pass:

- Keep `.range(offset, offset + limit - 1)` for all normal listing cases.
- Add guardrails so no public listing endpoint can accidentally return unbounded product lists.
- Normalize and cap requested `limit` values in API routes.
- Keep public listing limits conservative, for example 12, 20, or 24 products.

For price filtering, see Priority 3 because the best fix is both codebase and Supabase.

## Implementation Completed

The code-only pagination guardrails have been implemented.

Changed behavior:

- Product listing requests normalize invalid page values to page `1`.
- Product listing requests normalize invalid or missing limits to the default page size.
- Public storefront product listing limits are capped at `24`.
- `listPaginatedProducts` now protects direct server-side calls, not only API calls.
- `/api/storefront/products` also normalizes page and limit before calling the data layer.
- Wishlist and recently viewed product ID requests are sliced to the safe limit.
- Normal storefront listing queries continue to use Supabase `.range(...)`.
- Price-filtered listing queries are no longer unbounded in this code-only pass.

Files changed:

- `src/modules/store/constants.ts`
- `src/modules/store/utils/pagination.ts`
- `src/lib/data/products.ts`
- `src/app/api/storefront/products/route.ts`
- `tests/lib/products.test.ts`

## Manual Testing Completed

Manual testing was completed on 04 May 2026.

Passed checks:

- Store page loads correctly.
- Store page returns only one page of products.
- Store pagination works.
- Sorting works.
- Category product listing works.
- Collection product listing works.
- Price filter still works without loading the full catalog.
- Product quick view still loads product detail data.
- Wishlist/recently viewed product loading remains capped and functional.

## Quality Check Status

- `pnpm.cmd test tests\lib\products.test.ts`: passed
- `pnpm.cmd build`: passed
- `pnpm.cmd exec tsc --noEmit`: blocked by existing unrelated test type error in `tests/lib/actions/complete-checkout.test.ts:154`
- `pnpm.cmd lint`: blocked by existing project script issue because `next lint` is not valid in this Next.js setup

## Expected Impact

- Prevents accidental large responses.
- Keeps product listing egress predictable.
- Protects the Free Plan during category, collection, search, and store browsing.

## Risks / Notes

- Do not break manual pagination counts.
- If exact counts are expensive or unnecessary for some UI, consider whether the UI can use has-next-page behavior later.
- Some admin pages may intentionally export or fetch more data; this priority is mainly for public storefront listing pages.

## Acceptance Checks

- All public product listing APIs enforce a maximum `limit`.
- Product listing pages return only one page of products.
- Store pagination still works.
- Category and collection pagination still works.
- Price-filtered behavior is documented as requiring Priority 3 if not fully solved here.

## References

- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase database advisors: https://supabase.com/docs/guides/database/database-advisors
