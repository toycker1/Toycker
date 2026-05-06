# Remaining Risk: Visual Search And Embedding Work

## Classification

`code-only now; both (codebase + Supabase) if database tuning is later needed`

No Supabase migration is required now.

## Why This Risk Remains

Visual search accepts an uploaded image, processes it, creates an embedding, and then calls a Supabase RPC.

This is not normal database browsing. It is a heavier workflow.

Related files:

- `src/app/api/storefront/search/image/route.ts`
- `src/lib/ml/embeddings.ts`
- `src/modules/layout/hooks/useSearchResults.ts`
- `src/modules/search/components/VisualSearchInterface/index.tsx`
- `src/lib/data/search.ts`

## Current Evidence

The image search route currently:

- accepts only image files
- rejects files above `10MB`
- processes image with `sharp`
- resizes image before embedding
- calls `search_products_multimodal`
- returns at most `12` products for image search

Production evidence:

- `search_products_multimodal` exists.
- `search_analytics` estimated rows: `0`.
- product count is still small, about `295`.

## Git History To Check First

Before changing search behavior, inspect Git history for the completed search optimization work:

```powershell
git log --oneline -- src/lib/data/search.ts src/app/api/storefront/search src/modules/layout/hooks/useSearchResults.ts src/lib/constants/search.ts
git log --oneline -- supabase-free-plan-priorities/07-search-request-and-payload-optimization.md
git show --stat <relevant-commit>
```

This is important because Priority 7 already added text-search guards, debounce behavior, request aborting, and lightweight payloads. Do not make text search heavier while adjusting image search.

## What Is Already Good

- Text search requires a minimum query length.
- Text search response is lightweight.
- Image search has a file size limit.
- Image search result count is capped.
- The browser resizes the search image before upload in the search hook.

## What Can Still Increase Egress

- Users repeatedly uploading images.
- Large images close to the `10MB` limit.
- Bots or abuse against `/api/storefront/search/image`.
- RPC returning more rows in the future if limits are raised.
- Logging too much image-search detail in production logs.

## Recommended Action

Keep this as a monitored risk. Do not add complexity unless usage grows.

Code-only changes if needed:

1. Lower image-search max upload from `10MB` to `5MB`.
2. Add a simple per-session cooldown on image search.
3. Return only the same product summary fields as text search.
4. Remove non-essential production logs from image processing.
5. Keep `match_count` small, around `8` to `12`.

Supabase changes only if needed:

1. Review RPC performance in Supabase Query Performance.
2. Check whether vector/search indexes are healthy.
3. Add or tune indexes only if the RPC becomes slow.

## Implementation Trigger

Only implement this file if one of these is true:

- `/api/storefront/search/image` appears as a high-volume route.
- Supabase RPC logs show `search_products_multimodal` is expensive or frequent.
- Users report slow visual search and Supabase database requests increase at the same time.
- Uploaded image traffic becomes large compared with normal storefront browsing.

If normal text search is the issue, use Priority 7 instead.

## Simple Code-Only Plan If Image Search Is Too Expensive

1. Inspect `src/app/api/storefront/search/image/route.ts`.
2. Inspect `src/modules/layout/hooks/useSearchResults.ts`.
3. Keep the current resize-before-upload behavior.
4. Lower max image size only if needed, for example from `10MB` to `5MB`.
5. Keep `match_count` capped.
6. Return only product summaries.
7. Add a simple cooldown only if repeated abuse is confirmed.

Avoid adding:

- new database tables
- complex analytics
- queue systems
- paid third-party search services
- large image storage

## Simple Supabase Plan If RPC Is Slow

Only do this if Supabase query tools show RPC/database performance is the problem.

1. Use Supabase Query Performance or read-only `explain` style checks.
2. Confirm `search_products_multimodal` is actually slow.
3. Check indexes for vector/search columns.
4. Create a migration only if an index or function change is clearly needed.
5. Test the migration first in Toycker Development.

Do not tune production blindly.

## How To Avoid Breaking Existing Functionality

- Text search must remain unchanged.
- Visual search page must still accept valid images.
- Invalid files must still return clear errors.
- Product result shape must remain compatible with the UI.
- Do not remove image search unless the senior explicitly approves it.

## What Not To Do

- Do not disable visual search unless it becomes a real quota problem.
- Do not increase image upload size.
- Do not return full product detail from image search.
- Do not log image contents or sensitive data.

## Testing If Changed Later

1. Open search.
2. Try a valid JPG/PNG/WebP image.
3. Confirm matching products appear.
4. Try a file above the new size limit.
5. Confirm it is rejected clearly.
6. Confirm the API response contains only product summaries.
7. Confirm normal text search still works.

## References

- Supabase egress applies to database and function responses: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Supabase query performance debugging: https://supabase.com/docs/guides/api/rest/debugging-performance
