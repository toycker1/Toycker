# Toycker Frontend Performance Priority Index

Status: Priority 1 measurement implemented; Priority 2 media optimization implemented and manually verified; Priority 3 homepage performance implemented and manually verified
Last updated: 2026-05-11

This folder is separate from `supabase-free-plan-priorities`.

The Supabase priority files focus mainly on reducing database/API payload and request volume. These frontend performance files focus on Lighthouse, Core Web Vitals, media delivery, JavaScript execution, third-party scripts, browser caching, and page-level user experience.

## Why This Exists

The live mobile Lighthouse report for `toycker.com` showed:

- Performance: 54
- Accessibility: 87
- Best Practices: 81
- SEO: 100
- First Contentful Paint: 1.2s
- Largest Contentful Paint: 5.5s
- Total Blocking Time: 1,200ms
- Cumulative Layout Shift: 0
- Speed Index: 3.3s

Plain meaning:

- SEO is fine.
- Layout stability is fine.
- The main problem is slow visible content and heavy main-thread JavaScript.
- Large images, third-party scripts, and client-side work are the highest-risk areas.
- This is not mainly a Supabase database issue, but poor frontend performance can still hurt users, conversion, and bandwidth.

## Current Codebase Signals

The following local files are important for performance work:

- `next.config.js`
- `src/app/layout.tsx`
- `src/app/providers.tsx`
- `src/app/(main)/(home)/page.tsx`
- `src/modules/home/components/hero/index.tsx`
- `src/modules/home/components/exclusive-collections/index.tsx`
- `src/modules/home/components/review-media-hub/index.tsx`
- `src/modules/products/components/product-preview/index.tsx`
- `src/modules/products/components/image-gallery/index.tsx`
- `src/modules/store/templates/index.tsx`
- `src/modules/cart/templates/index.tsx`
- `src/modules/checkout/templates/checkout-form/index.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/products/page.tsx`
- `src/app/admin/orders/page.tsx`
- `src/app/admin/home-settings/page.tsx`
- `src/lib/analytics/index.tsx`
- `src/lib/analytics/meta-pixel.tsx`
- `src/sw.ts`
- `src/lib/r2.ts`
- `src/lib/actions/storage.ts`

Also check Git logs before implementing:

```bash
git log --oneline --decorate --stat -- supabase-free-plan-priorities frontend-performance-priorities next.config.js src/app src/modules src/lib
git log --oneline --grep="perf"
```

This helps the next developer or AI understand what was already optimized and avoid undoing completed Supabase egress work.

## Priority Files

1. `01-lighthouse-core-web-vitals-and-measurement.md`
   - Implemented. Baseline metrics, Lighthouse meaning, testing process, and success targets.

2. `02-media-image-video-and-cdn-optimization.md`
   - Implemented. Hero banners, product images, videos, Cloudflare cache behavior, image formats, and upload rules.

3. `03-home-page-performance-plan.md`
   - Implemented. Homepage hero, lightweight product rails, category marquee, shop by age, exclusive collections, reviews, footer, and above-the-fold loading.

4. `04-store-search-product-detail-performance-plan.md`
   - Store listing, categories, collections, search drawer, visual search, product detail, galleries, related products, and recently viewed.

5. `05-cart-checkout-wishlist-account-orders-performance-plan.md`
   - Cart, checkout, wishlist, customer account, order history, and order detail performance.

6. `06-admin-dashboard-products-orders-home-settings-performance-plan.md`
   - Admin dashboard, admin product lists, import/export, orders, home settings, media previews, reviews, and global search.

7. `07-javascript-third-party-providers-and-pwa-performance-plan.md`
   - GTM, Meta Pixel, Contentsquare, Vercel analytics, Sentry, global providers, chatbot, PWA service worker, and client bundle weight.

8. `08-implementation-order-and-quality-checks.md`
   - Safe execution order, what is code-only vs Cloudflare-only vs both, and required quality checks.

## Priority Order

Do these first:

1. Optimize above-the-fold hero media.
2. Fix media upload/cache rules so new images and videos do not regress.
3. Delay or conditionally load third-party scripts.
4. Reduce root/global client-side provider work.
5. Audit store/product media and image sizing.
6. Audit admin media previews and heavy admin-only packages.

Do later:

1. Advanced bundle splitting.
2. Advanced service worker strategies.
3. Optional Cloudflare Image Resizing or Cloudflare Images.
4. Deep page-by-page JavaScript profiling.

## Scope Classification

Code-only:

- Component-level lazy loading.
- Third-party script strategy changes.
- Provider splitting.
- Image `sizes`, `priority`, `fetchPriority`, and loading behavior.
- Admin UI pagination/lazy previews.

Cloudflare/media-only:

- Re-uploading optimized images.
- Updating CDN cache rules.
- Enabling Cloudflare image resizing/transforms if available.
- Purging bad cached assets.

Both code + Cloudflare/media:

- Responsive image variants.
- New upload pipeline rules.
- Hero/banner format and size enforcement.
- Video poster and preview behavior.

Supabase:

- No Supabase migration is required for the frontend performance plan by default.
- Supabase changes are only needed if a page still fetches heavy data or performs slow database queries. Those items already belong to the Supabase egress priorities.

## Definition Of Done

This frontend performance track is done only when:

- Lighthouse mobile Performance is consistently above 80 on production or a production-like preview.
- LCP is below 2.5s for the homepage on a reasonable mobile network.
- TBT is below 200ms where possible.
- Images are not massively larger than their displayed size.
- Third-party scripts do not block the first render.
- Public pages do not load admin-only JavaScript.
- Admin pages remain usable but do not load all media/video previews at once.
- No existing checkout/cart/order/admin workflows break.

## Sources To Recheck Before Implementation

- Web.dev LCP: https://web.dev/articles/optimize-lcp
- Web.dev INP: https://web.dev/articles/inp
- Next.js Image docs: https://nextjs.org/docs/app/getting-started/images
- Next.js Script docs: https://nextjs.org/docs/app/api-reference/components/script
- Next.js lazy loading docs: https://nextjs.org/docs/app/guides/lazy-loading
- Chrome Lighthouse TBT: https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time
- Chrome Lighthouse responsive images: https://developer.chrome.com/docs/lighthouse/performance/uses-responsive-images
- Chrome Lighthouse cache policy: https://developer.chrome.com/docs/lighthouse/performance/uses-long-cache-ttl
- Cloudflare cache docs: https://developers.cloudflare.com/cache/
