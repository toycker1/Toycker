# Priority 2: Media, Image, Video, And CDN Optimization

Status: Implemented, production-adjusted to direct Cloudflare media delivery on 2026-05-13
Change type: both code + Cloudflare/media
Supabase migration required: No

## Implementation Status

Current status: Priority 2 remains implemented, but the image delivery strategy was changed after production usage limits were hit.

### Original Priority 2 Implementation - 2026-05-11

The original Priority 2 implementation focused on improving storefront media quality and perceived performance while keeping media storage in Cloudflare/R2.

- Next.js image optimization was enabled for Cloudflare-hosted images.
- Public storefront image components kept using `next/image`.
- Hero banners, product thumbnails, exclusive collection posters, and product gallery images requested `quality={95}`.
- Product gallery zoom used the original image URL by setting `unoptimized` on the zoom image.
- GIFs remain unoptimized so animation is not broken.
- Exclusive Collection videos still autoplay, loop, stay muted, and keep their original uploaded video quality.
- Uploaded media gets long immutable cache headers through the existing R2 upload flow.
- Upload limits remain prototype-friendly while allowing better source media quality: product/banner/category/collection images up to 5 MB, exclusive videos up to 20 MB.
- A lossless WebP fallback was added for the homepage fallback banner.
- The service worker was regenerated as part of the production build output.

Original request behavior:

- Homepage hero image requests used Vercel `/_next/image` with `q=95`.
- Store product card image requests used Vercel `/_next/image` with `q=95`.
- Cloudflare still stored the files, but Vercel transformed and served optimized image responses to the browser.

### Production Adjustment - 2026-05-13

Vercel Image Optimization usage limits were exceeded in production. When the limit was hit, images on the live site could fail even though the original files existed in Cloudflare/R2.

The implementation was adjusted to prioritize reliable live media delivery:

- `next.config.js` now uses `images.unoptimized: true`.
- The old `IMAGE_QUALITIES` and `DISABLE_NEXT_IMAGE_OPTIMIZATION` config path was removed.
- Cloudflare-hosted images are now requested directly from their public media URLs, such as `https://cdn.toycker.in/...`.
- Existing `next/image` components were kept in place to avoid a broad component refactor.
- Existing `fill`, `sizes`, `priority`, `loading`, layout classes, hover states, and carousel behavior were kept.
- Existing `quality={95}` props were left in components. They no longer create Vercel image transformations while global image optimization is disabled.
- Videos were not changed because they already load directly from their `video_url` values.
- Supabase was not changed because it only stores and returns media URL fields.

Current request behavior:

- Homepage hero image requests should use `https://cdn.toycker.in/...`, not `/_next/image`.
- Store product card image requests should use `https://cdn.toycker.in/...`, not `/_next/image`.
- Product detail gallery and zoom images should still display.
- Exclusive Collection autoplay videos should still display and play.

### What Was Intentionally Kept

- Cloudflare/R2 remains the source for uploaded product, banner, category, collection, review, audio, and video media.
- `src/lib/util/media-url.ts` remains the central helper for building public Cloudflare media URLs.
- `src/lib/util/images.ts` remains the normalization helper for product and legacy image URLs.
- Admin upload flows continue using the existing R2 presigned upload system and immutable cache headers.
- Storefront components continue using `next/image` for now, but without Vercel image optimization.
- Small local assets under `public/` can still be served as static Vercel assets. They are separate from uploaded Cloudflare/R2 product media.

### Future Note: If Removing `next/image`

If we later remove `next/image`, do it as a separate task. Do not mix it with this production quota fix.

Recommended future approach:

1. Create a small reusable media component or use plain `<img>` only in the affected storefront/admin media surfaces.
2. Preserve the existing `src`, `alt`, `loading`, `sizes`, responsive layout, object-fit, carousel, hover, and fallback behavior.
3. Keep `fixUrl`, `buildPublicMediaUrl`, and Cloudflare/R2 URL normalization unchanged.
4. Remove `quality={95}` props at that time because plain `<img>` does not use them.
5. Verify homepage, product listing, product detail gallery, cart/sidebar thumbnails, wishlist, account orders, admin previews, and review media.
6. Only consider Cloudflare Images or Cloudflare image resizing after the direct Cloudflare delivery path is stable.

Supabase check:

- No Supabase migration was required.
- Supabase continues to return media URL fields such as `image_url`, `thumbnail`, `poster_url`, `video_url`, and `images`.
- Supabase does not return actual image or video file bytes for this Priority 2 work.
- Heavy media downloads are handled by Cloudflare media delivery in the browser, not by Supabase responses.

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

## Remaining Optimization Backlog

These are not part of the 2026-05-13 production adjustment. They are future performance tasks after direct Cloudflare delivery is stable.

1. Confirm whether Cloudflare currently serves optimized image variants.
2. If Cloudflare does not resize/convert images, consider one simple follow-up path:
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
5. Confirm homepage banner images request `https://cdn.toycker.in/...`.
6. Confirm product listing thumbnails request `https://cdn.toycker.in/...`.
7. Confirm product detail gallery images request `https://cdn.toycker.in/...`.
8. Confirm no uploaded storefront image request uses `/_next/image`.
9. Check response headers:
   - `Cache-Control`
   - `cf-cache-status`
   - content type
10. Reload again with cache enabled.
11. Confirm repeated media comes from memory/disk/service worker cache where expected.
12. Run Lighthouse Mobile only as a follow-up performance check. Direct Cloudflare delivery fixes Vercel image quota failures first; it may not reduce image-size warnings by itself.

## Sources

- Next.js Image docs: https://nextjs.org/docs/app/getting-started/images
- Chrome responsive images audit: https://developer.chrome.com/docs/lighthouse/performance/uses-responsive-images
- Chrome modern image formats audit: https://developer.chrome.com/docs/lighthouse/performance/uses-webp-images
- Chrome cache policy audit: https://developer.chrome.com/docs/lighthouse/performance/uses-long-cache-ttl
- Cloudflare cache docs: https://developers.cloudflare.com/cache/
