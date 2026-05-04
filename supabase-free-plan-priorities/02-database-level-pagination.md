# Priority 2: Database-Level Pagination

## Classification

`code-only`

## Priority

Do this immediately after lightweight product listing queries.

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
