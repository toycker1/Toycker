# Priority 10: Media And Storage Egress Control

## Classification

`code-only for the current Toycker implementation`

This priority was originally classified as `both (codebase + Supabase)`, but the current project evidence shows media is served from Cloudflare R2/CDN, not Supabase Storage. No Supabase migration or bucket configuration change was required.

## Status

`Implemented on 05 May 2026; manual workflow verification pending`

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

Additional implementation evidence from the linked development project:

- Supabase Storage bucket count: `0`
- Product URLs using Supabase Storage: `0`
- Product URLs using `cdn.toycker.in`: `272`
- Review media `storage_provider`: `r2`

So the current risk is not Supabase Storage egress. The practical work is to keep Cloudflare R2/CDN media uploads bounded, cacheable, and not aggressively downloaded by the browser.

## Implemented Changes

Codebase changes:

- Added shared upload limits in `src/lib/constants/upload-file-types.ts`.
- Added long-lived immutable cache metadata for new R2 uploads:

```txt
Cache-Control: public, max-age=31536000, immutable
```

- Updated R2 presigned upload generation to validate file size server-side before signing the upload.
- Updated product, banner, category, collection, exclusive video, and review media upload callers to pass file size and send the cache header.
- Reduced exclusive collection video upload limit from `50MB` to `20MB`.
- Added review media validation before upload so unsupported or oversized files are skipped/rejected.
- Changed homepage exclusive collection video preload behavior from `auto` to `metadata`.
- Added `loading="lazy"` to product/admin YouTube iframes.
- Added lighter preload behavior to review/admin video previews.
- Removed one directly touched `any` from product image gallery event handling.

Current upload limits:

| Place / Folder | Allowed Media | Max Size |
| --- | --- | --- |
| `products` | JPG, PNG, WebP, GIF | `5MB` |
| `banners` | JPG, PNG, WebP | `5MB` |
| `categories` | JPG, PNG, WebP | `5MB` |
| `collections` | JPG, PNG, WebP | `5MB` |
| `exclusive-videos` | MP4, WebM | `20MB` |
| `reviews` | JPG, PNG, WebP, MP4, WebM audio, MP4 audio, MP3 | `20MB` |

## Migration Decision

No Supabase migration was created.

This means:

- No new tables were created.
- No existing tables were changed.
- No RLS policies were created or updated.
- No existing data was changed.
- No Supabase Storage buckets were created or modified.

The existing storefront, admin, cart, checkout, review, and product workflows should not be affected by database or Supabase configuration changes because this implementation only changed code-level media upload and playback behavior.

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

## Quality Checks

- `pnpm.cmd build` passed.
- `pnpm.cmd exec tsc --noEmit` still fails because of an existing unrelated test issue in `tests/lib/actions/complete-checkout.test.ts`.
- `pnpm.cmd lint` still fails because the existing project lint script resolves `next lint` as a `lint` directory.
- `git diff --check` passed.

## Manual Testing Still Needed

After browser testing passes, update this file again to mark the priority as manually verified.

Required checks:

- Storefront product images still load from `cdn.toycker.in`.
- DevTools Network does not show Supabase `storage/v1` media requests on storefront pages.
- Product image upload works for valid files and rejects invalid/oversized files.
- Banner/category/collection image upload still works.
- Exclusive collection video upload works under `20MB` and rejects files above `20MB`.
- Review image/video/audio upload still works for valid media.
- Product detail YouTube video, add-to-cart, wishlist, cart, checkout, admin product edit, admin home settings, and admin reviews still work.

## References

- Supabase Storage bandwidth: https://supabase.com/docs/guides/storage/serving/bandwidth
- Supabase Storage scaling/optimization: https://supabase.com/docs/guides/storage/production/scaling
- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
