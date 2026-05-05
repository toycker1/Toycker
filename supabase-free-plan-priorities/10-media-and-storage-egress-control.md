# Priority 10: Media And Storage Egress Control

## Classification

`both (codebase + Supabase)`

## Priority

Do this later unless product media is moved to Supabase Storage or Storage egress starts increasing.

## Problem

Storage downloads can consume Supabase egress quickly if large images/videos are served directly from Supabase Storage. Cached Storage egress and uncached egress have separate behavior, but both matter on the Free Plan.

## Current Toycker Evidence

The supplied dashboard screenshot showed:

- Storage Size: 0 GB / 1 GB
- Storage Requests: low
- Cached Egress: 0 GB

This suggests Supabase Storage is not currently the main egress source.

The repo has many local media files under `public/assets`, which are served by the Next.js host rather than Supabase Storage.

## Recommended Fix

Only apply this if Supabase Storage is used for product/review/admin media.

Codebase changes:

- Upload compressed images.
- Use WebP/AVIF where possible.
- Use thumbnails in product grids.
- Lazy-load below-the-fold images.
- Avoid autoplaying large videos from Supabase Storage.
- Do not use original large files for product cards.

Supabase changes:

- Use appropriate bucket cache headers.
- Remove unused files.
- Separate original and thumbnail paths.
- Review public/private bucket policies.
- Monitor cached and uncached Storage egress.

## Expected Impact

- Prevents media from becoming the next Free Plan limit issue.
- Improves storefront load time.
- Reduces bandwidth from repeat visitors when cache headers are effective.

## Risks / Notes

- Do not delete media that is referenced by products, reviews, banners, or admin content.
- Storage cache changes can affect how quickly replaced images appear.
- If using an external object store/CDN, document that separately.

## Acceptance Checks

- Product cards use optimized thumbnail-sized media.
- Product detail pages can still show higher quality media when needed.
- Storage dashboard usage remains low.
- No broken image/video URLs after cleanup.

## References

- Supabase Storage bandwidth: https://supabase.com/docs/guides/storage/serving/bandwidth
- Supabase Storage scaling/optimization: https://supabase.com/docs/guides/storage/production/scaling
- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
