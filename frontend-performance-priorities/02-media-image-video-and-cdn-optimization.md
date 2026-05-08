# Priority 2: Media, Image, Video, And CDN Optimization

Status: Pending implementation
Change type: both code + Cloudflare/media
Supabase migration required: No

## Goal

Reduce image/video download size and improve LCP without moving storage away from Cloudflare.

Toycker stores images, video, and other media in Cloudflare-backed storage/CDN. That should continue. The problem is not where media is stored. The problem is that some media is too large for how it is displayed, and some CDN cache behavior is too short for versioned assets.

## Current Findings

From the Lighthouse screenshots:

- A homepage banner image is about 2.4 MB.
- That banner is displayed much smaller than its original dimensions.
- Lighthouse reports "Improve image delivery" with about 2.8 MB possible savings.
- Lighthouse reports "Use efficient cache lifetimes" with about 2.3 MB possible savings.
- CDN media in screenshots showed cache TTL around 4h.

From local files:

- `next.config.js` has `images.unoptimized: true`.
- This means Next.js is not resizing or converting remote images.
- `public/assets/images/slider_default.png` is about 2.04 MB.
- `public/assets/images/about_page.png` and `about-page.png` are about 2.07 MB each.
- `public/assets/images/gift-wrap.png` is about 1.99 MB.
- `public/assets/videos/exclusive-*.mp4` files are about 1.65 MB to 2.65 MB each.

## Why This Matters

Large images hurt:

- LCP
- mobile data usage
- perceived load speed
- repeat visits when cache TTL is too short
- Cloudflare bandwidth

Large videos hurt:

- page load
- memory
- mobile CPU
- battery
- admin home settings performance

## Required Media Rules

Use these limits for new uploads.

Homepage hero/banner:

- Desktop display target: about 1440px wide maximum.
- Mobile display target: about 768px wide maximum.
- Format: WebP or AVIF preferred.
- Fallback: optimized JPEG.
- Avoid PNG unless transparency is truly needed.
- Target size: ideally under 300 KB for mobile and under 600 KB for desktop.

Product thumbnails:

- Display target: usually 300-500px.
- Format: WebP/JPEG.
- Target size: ideally under 100 KB.
- Do not load the full original product image for grid thumbnails.

Product gallery:

- Main image can be larger than thumbnail.
- Use responsive sizes.
- Load only the first visible image eagerly.
- Lazy-load later gallery images.

Admin media previews:

- Use thumbnails/posters.
- Do not autoplay many videos at once.
- Use `preload="metadata"` or `preload="none"` for videos unless actively previewed.

Videos:

- Public homepage videos should not load until near viewport or user intent.
- Use poster images.
- Use compressed MP4/WebM.
- Keep short promotional videos small.
- Avoid multiple autoplaying videos above the fold.

## Cloudflare/CDN Requirements

For versioned media URLs such as UUID filenames:

- Use long cache headers.
- Prefer `Cache-Control: public, max-age=31536000, immutable`.
- If a file changes, upload it with a new filename.
- Do not overwrite files with the same URL unless the CDN cache is purged.

For non-versioned URLs:

- Use shorter TTL.
- Or change the upload system to always use versioned filenames.

## Code Areas To Inspect

- `next.config.js`
- `src/lib/r2.ts`
- `src/lib/actions/storage.ts`
- `src/lib/util/media-url.ts`
- `src/lib/util/images.ts`
- `src/lib/util/image-processing.ts`
- `src/modules/admin/components/image-uploader/index.tsx`
- `src/modules/admin/components/media-manager/index.tsx`
- `src/modules/home/components/hero/index.tsx`
- `src/modules/home/components/exclusive-collections/index.tsx`
- `src/modules/home/components/review-media-hub/index.tsx`
- `src/modules/products/components/product-preview/index.tsx`
- `src/modules/products/components/image-gallery/index.tsx`

## Implementation Plan

1. Confirm whether Cloudflare currently serves optimized image variants.
2. If Cloudflare does not resize/convert images, either:
   - enable Cloudflare image resizing/transforms, or
   - generate optimized variants during upload.
3. Add or verify long cache headers for immutable UUID media.
4. Add strict admin upload guidance:
   - hero images must be optimized,
   - product images should be compressed,
   - video files should use poster images.
5. Update public components so:
   - only true LCP image is eager/priority,
   - non-visible images are lazy,
   - correct `sizes` values are set,
   - videos do not preload full files.
6. Re-run Lighthouse after optimizing only a few high-impact assets first.

## What Should Not Change

- Do not move images/video/audio out of Cloudflare.
- Do not store media in Supabase Storage.
- Do not break existing product image URLs.
- Do not remove product images from the storefront.
- Do not make admin upload workflow too complex for a basic prototype.

## Manual Testing

1. Open homepage in Incognito.
2. Open DevTools Network.
3. Filter by `cdn.toycker.in`.
4. Reload the page.
5. Check top banner image size.
6. Check response headers:
   - `Cache-Control`
   - `cf-cache-status`
   - content type
7. Reload again with cache enabled.
8. Confirm repeated media comes from memory/disk/service worker cache where expected.
9. Run Lighthouse Mobile.
10. Confirm "Improve image delivery" savings are lower.

## Sources

- Next.js Image docs: https://nextjs.org/docs/app/getting-started/images
- Chrome responsive images audit: https://developer.chrome.com/docs/lighthouse/performance/uses-responsive-images
- Chrome modern image formats audit: https://developer.chrome.com/docs/lighthouse/performance/uses-webp-images
- Chrome cache policy audit: https://developer.chrome.com/docs/lighthouse/performance/uses-long-cache-ttl
- Cloudflare cache docs: https://developers.cloudflare.com/cache/
