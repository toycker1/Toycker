# Remaining Risk: Home Page Cached Media And Feature Sections

## Purpose

This file covers home page sections that combine Supabase metadata with Cloudflare-hosted images or videos.

The current setup is mostly safe because media is served from Cloudflare CDN/R2, while Supabase stores only metadata and URLs. Still, home page sections can become a risk if they start fetching too much metadata, load too many media URLs, or bypass cache.

## Status

`Completed and manually verified on 09 May 2026`

The main home page exclusive collections path has been optimized so it no longer fetches full product rows for cached media sections. No Supabase migration was required.

Manual testing confirmed that:

- The home page still renders banners and exclusive collection sections.
- Exclusive collection product cards still show image, name, price, and club price.
- Media requests use `https://cdn.toycker.in/...`.
- The visible video elements do not preload full video files upfront.
- The home layout state response remains small.
- The exclusive collection data path no longer requests heavy product fields.

## Classification

`code-only + Cloudflare checks if needed`

No Supabase migration is expected unless a future feature requires a new database structure. Do not create tables just for this risk.

## Related Files

- `src/lib/data/home-banners.ts`
- `src/lib/data/exclusive-collections.ts`
- `src/lib/actions/home-banners.ts`
- `src/lib/actions/home-exclusive-collections.ts`
- `src/lib/actions/home-reviews.ts`
- `src/modules/home`
- `src/lib/util/media-url.ts`
- `src/lib/r2.ts`
- `src/sw.ts`

## Current Code Observation

Good current behavior:

- `listHomeBanners()` uses `unstable_cache` with `revalidate: 3600`.
- `listExclusiveCollections()` uses `unstable_cache` with `revalidate: 3600`.
- Home banner select uses explicit fields.
- Media URL validation blocks Supabase Storage URLs.
- Media should use `cdn.toycker.in`.

Remaining watch area:

- Home page videos can still create large Cloudflare/browser traffic if many videos are displayed.
- Service worker/cache behavior can make repeated media requests appear in DevTools, even when served from cache.
- Future code changes must not reintroduce full product rows in home page cached sections.

Completed implementation:

- `src/lib/data/exclusive-collections.ts` now selects only the product fields needed by the home page:
  - `id`
  - `name`
  - `handle`
  - `image_url`
  - `thumbnail`
  - `price`
  - `currency_code`
- `src/modules/home/components/exclusive-collections/index.tsx` now derives display image and price from the lightweight payload.
- The previous hidden media preloader was removed.
- Visible videos use lightweight metadata loading instead of preloading full video content.

Quality checks:

- `pnpm.cmd exec tsc --noEmit` passed.
- `pnpm.cmd build` passed. The build printed expected sandbox network warnings while prerendering pages that fetch Supabase data.
- `git diff --check` passed.
- `pnpm.cmd lint` is still blocked by the existing repo lint script issue where `next lint` treats `lint` as a project directory.

## Why This Is Different From Supabase Egress

Cloudflare media traffic is not Supabase Storage egress.

If the URL is `https://cdn.toycker.in/...`, the media is served through Cloudflare/CDN, not Supabase Storage.

Supabase egress for these sections usually comes from metadata queries, such as:

- home banner rows
- exclusive collection rows
- product title/handle/image URL metadata
- review metadata

The large image/video bytes should not come from Supabase.

## Required Git History Check

Before changing home page media sections, inspect Git history:

```powershell
git log --oneline -- src/lib/data/home-banners.ts src/lib/data/exclusive-collections.ts src/lib/actions/home-banners.ts src/lib/actions/home-exclusive-collections.ts src/lib/util/media-url.ts src/lib/r2.ts src/sw.ts
git log --oneline -- supabase-free-plan-priorities/17-media-cdn-cache-regression-risk.md
git show --stat <recent-or-relevant-commit>
```

This is important because media/CDN guardrails and home settings behavior were already changed. Do not reintroduce Supabase Storage URLs.

## What Can Increase Egress Or Traffic

Supabase egress risks:

- Home page sections stop using cache.
- Home page queries start selecting full product rows.
- Home page queries include descriptions, SEO data, embeddings, or full related data.
- Admin home settings repeatedly loads all media metadata without limits.

Cloudflare/media traffic risks:

- Many videos autoplay or preload.
- Large images are uploaded without size control.
- Media URLs bypass `cdn.toycker.in`.
- Cache-Control headers regress.
- Service worker caches duplicate media requests in a confusing way.

## When To Implement

Only implement if one of these is true:

- Supabase Logs shows home page queries as high egress.
- The home page starts returning full product detail rows.
- Cloudflare dashboard shows poor cache hit ratio for Toycker media.
- Supabase Storage usage becomes greater than zero.
- `cdn.toycker.in` media URLs are replaced by Supabase Storage URLs.

## Simple Implementation Plan If Needed

1. Confirm whether the problem is Supabase JSON or Cloudflare media bytes.
2. If it is Supabase JSON:
   - inspect home data functions
   - remove unused fields
   - keep `unstable_cache`
   - avoid full product selects
3. If it is media bytes:
   - inspect Cloudflare cache headers
   - inspect file sizes
   - avoid autoplay/preload for videos
   - keep upload size limits
4. Do not move media to Supabase Storage.
5. Do not change storefront design unless the issue is measured.

## Safe Home Section Fields

For banners:

```txt
id
title
image_url
alt_text
link_url
sort_order
is_active
starts_at
ends_at
```

For exclusive collections:

```txt
id
product_id
video_url
poster_url
video_duration
sort_order
product id
product name
product handle
product image_url or thumbnail
product price
```

Avoid unless clearly needed:

```txt
product description
seo_metadata
image_embedding
search_vector
all related products
large metadata objects
```

## Manual Testing If Changed Later

1. Open `/`.
2. Confirm home banners show.
3. Confirm exclusive collections show.
4. Confirm media URLs use `cdn.toycker.in`.
5. Confirm Supabase Storage URLs are not used.
6. Confirm refresh does not repeatedly call large Supabase metadata responses.
7. Confirm admin `/admin/home-settings` still loads and saves settings.
8. Confirm video/poster upload limits still work.
9. Confirm production build passes.

## Simple Senior Explanation

Home page media stays on Cloudflare. Supabase now returns only small metadata and the specific product fields needed for the exclusive collection cards. The large image and video bytes should come from `cdn.toycker.in`, not Supabase Storage. The remaining risk is only future regression: a later code change must not fetch full product rows or move media back to Supabase Storage.

