# Priority 7: Search Request And Payload Optimization

## Classification

`code-only`

## Priority

Do this after product listing/query cleanup, because search should reuse lightweight product summary shapes.

## Problem

Search can create many small requests while the user types. Each Supabase database response contributes to egress. Search should be debounced, capped, cached briefly, and return only summary data.

## Current Toycker Evidence

In `src/modules/layout/hooks/useSearchResults.ts`:

```ts
const debouncedQuery = useDebounce(query.trim(), 200)
```

The hook queries whenever `debouncedQuery` is non-empty. It does not currently require a 2-3 character minimum.

In `src/app/api/storefront/search/route.ts`, the API sends:

```ts
Cache-Control: public, s-maxage=30, stale-while-revalidate=120
```

In `src/lib/data/search.ts`, product search uses:

```ts
supabase.rpc("search_products_multimodal", {
  search_query: normalizedQuery,
  match_count: productLimit,
  match_threshold: 0.1,
})
```

Category and collection results are limited with `.limit(taxonomyLimit)`.

## Recommended Fix

Code-only changes:

- Increase debounce to 300-500 ms.
- Require at least 2 or 3 characters before querying text search.
- Keep `productLimit` and `taxonomyLimit` capped server-side.
- Ensure search RPC returns only product summary fields used by UI.
- Keep short API response caching for repeated identical searches.
- Keep client-side in-memory cache for the current session.

Recommended defaults:

```txt
minimum query length: 2 characters
debounce: 300 ms
product limit: 6
taxonomy limit: 5
server max product limit: 10
server max taxonomy limit: 10
```

## Expected Impact

- Fewer search requests.
- Smaller search responses.
- Lower Supabase database egress during active typing.

## Risks / Notes

- A minimum query length changes UX for 1-character searches.
- Image search is separate and should keep its own limits.
- If the RPC returns large rows, the RPC definition may need later Supabase work; however, the first pass can still cap calls and limits in code.

## Acceptance Checks

- Typing one character does not call the search API.
- Normal search still returns products/categories/collections.
- Search response is limited and lightweight.
- Server rejects or clamps excessive `productLimit`/`taxonomyLimit`.
- Visual/image search still works.

## References

- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase database advisors: https://supabase.com/docs/guides/database/database-advisors
