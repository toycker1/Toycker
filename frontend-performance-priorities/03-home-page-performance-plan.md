# Priority 3: Home Page Performance Plan

Status: Pending implementation
Change type: mostly code-only, with media/CDN support
Supabase migration required: No

## Goal

Improve homepage mobile performance because homepage is usually the highest-traffic page and the Lighthouse report was generated against the live homepage.

## Current Homepage Structure

Main file:

- `src/app/(main)/(home)/page.tsx`

Important components:

- `src/modules/home/components/hero/server.tsx`
- `src/modules/home/components/hero/index.tsx`
- `src/modules/home/components/category-marquee/index.tsx`
- `src/modules/home/components/popular-toy-set/index.tsx`
- `src/modules/home/components/shop-by-age/index.tsx`
- `src/modules/home/components/exclusive-collections/server.tsx`
- `src/modules/home/components/exclusive-collections/index.tsx`
- `src/modules/home/components/best-selling/index.tsx`
- `src/modules/home/components/review-media-hub/index.tsx`
- `src/modules/home/components/why-choose-us/index.tsx`
- `src/modules/layout/templates/footer/index.tsx`

Good existing choices:

- Some below-the-fold sections use `dynamic`.
- Some sections use `Suspense`.
- `LazyLoadSection` exists.
- Home banners and exclusive collections already use cached data helpers.

Remaining problems:

- Hero media is likely the LCP element and is too large.
- Pre-mounted hero fallback currently marks the first three images as `priority`.
- The final hero marks only index 0 as priority, which is better.
- Below-the-fold videos can still load metadata or repeat through carousel/service worker behavior.
- `listHomeReviewsStorefront()` runs on the homepage and review media can add weight.
- Global providers and analytics still load on homepage.

## Highest Priority Fixes

### 1. Hero Banner

What to do:

- Only the first visible hero image should be priority/eager.
- Use `fetchPriority="high"` only for the true LCP image.
- Do not priority-load multiple carousel images on mobile.
- Use correct responsive `sizes`.
- Use optimized hero image variants.
- Keep a stable aspect ratio to preserve CLS.

Why:

The Lighthouse report points to the hero/banner area as a major performance issue.

### 2. Category Marquee

What to do:

- Keep it lightweight.
- Avoid heavy animation JS.
- Use CSS-only animation where possible.
- Do not fetch extra data on every render if categories are static enough to cache.

### 3. Popular Toy Set And Best Selling

What to do:

- Keep product cards lightweight.
- Load only card fields.
- Use thumbnail-sized images.
- Lazy-load below-the-fold product rails.
- Keep product list caching from the Supabase priorities.

### 4. Shop By Age

What to do:

- Keep dynamic loading if section is below the fold.
- Avoid loading large images before user scroll.

### 5. Exclusive Collections

Current risk:

- Multiple video assets can appear in Network.
- The carousel can trigger repeated media requests through service worker/cache.

What to do:

- Use poster image first.
- Do not autoplay all offscreen videos.
- Use `preload="metadata"` or `preload="none"`.
- Start video only when card is visible or hovered/tapped.
- Keep admin-defined runtime duration as display/timing metadata only, not a reason to preload.

### 6. Review Media Hub

What to do:

- Keep it below the fold.
- Lazy-load images/video/audio.
- Use small posters/thumbnails.
- Do not load review video/audio until visible or clicked.

### 7. Why Choose Us And Footer

What to do:

- Use optimized local images.
- Convert decorative PNGs to WebP/AVIF where possible.
- Lazy-load footer decorative images.

## What Should Not Break

- Homepage carousel should still rotate.
- Banner links should still work.
- Product cards should still link to product detail.
- Exclusive collections should still display videos/posters.
- Review section should still show approved reviews.
- Club/discount pricing should remain correct.

## Recommended Implementation Order

1. Optimize hero image behavior first.
2. Compress/re-upload current active homepage banners.
3. Make exclusive collection videos load only when visible or interacted with.
4. Make review media load only when visible.
5. Re-run Lighthouse.
6. Only then touch less important sections.

## Manual Testing

1. Open `/` in Incognito.
2. Open DevTools Network.
3. Disable cache for first run.
4. Reload.
5. Confirm only one above-the-fold hero image is high priority.
6. Confirm below-the-fold videos do not fully download on initial load.
7. Scroll to exclusive collections and verify videos/posters work.
8. Scroll to review media and verify media works.
9. Run Lighthouse Mobile.
10. Compare LCP and TBT against the old report.

## Expected Result

The homepage should:

- Load a smaller first banner.
- Reduce LCP.
- Reduce total transferred image bytes.
- Avoid loading below-the-fold videos too early.
- Keep the same visible design and user flow.
