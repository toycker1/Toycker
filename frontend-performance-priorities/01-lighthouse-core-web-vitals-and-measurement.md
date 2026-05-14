# Priority 1: Lighthouse, Core Web Vitals, And Measurement

Status: Implemented and locally verified on 2026-05-11
Change type: code-only for instrumentation, manual testing for measurement
Supabase migration required: No

## Goal

Create a reliable measurement process before changing performance-sensitive code.

The current Lighthouse mobile report shows that the main performance problems are:

- Slow Largest Contentful Paint.
- High Total Blocking Time.
- Heavy image payloads.
- Heavy JavaScript and third-party scripts.
- Render-blocking CSS/JS.

This priority does not change product behavior. It creates a repeatable way to verify whether later optimizations actually help.

## Current Report Summary

From the live Lighthouse screenshots:

- Performance score: 54
- FCP: 1.2s
- LCP: 5.5s
- TBT: 1,200ms
- CLS: 0
- Speed Index: 3.3s

## Local Baseline Captured On 2026-05-11

The measurement instrumentation was verified locally with `pnpm.cmd build` and `pnpm.cmd start`.

Verified pages:

- `/`
- `/store`
- `/cart`
- `/checkout?step=address`
- `/admin`
- `/admin/products`

At the time of this baseline, DevTools Network showed `/api/cache/telemetry` requests returning `204`. Custom telemetry was later removed for the Vercel usage optimization work, so new checks should confirm that no `/api/cache/telemetry` request is sent.

Homepage local Lighthouse mobile baseline:

| Run | Performance | FCP | LCP | TBT | CLS | Speed Index |
| --- | --- | --- | --- | --- | --- | --- |
| Before 1 | 37 | 1.4s | 42.5s | 4,780ms | 0 | 7.6s |
| Before 2 | 39 | 1.4s | 41.9s | 4,850ms | 0 | 6.3s |
| Before 3 | 38 | 1.4s | 41.1s | 4,770ms | 0 | 6.7s |

Network baseline from local homepage:

- Request count: 89
- Transfer size: 2.7 MB
- Resource size: 31.0 MB
- Largest visible transferred image: `7974c50c-8fbb-423c-aeaf-e5b9b76bb5df.jpg`, 117 kB
- Largest visible JavaScript chunks: `76834_react-icons_fa6_index_mjs_60ed0b55._js`, 519 kB, and `76834_react-icons_fa_index_mjs_409e004f._js`, 455 kB
- Media files appeared mostly from disk cache during this local run.

Plain meaning:

- The first paint is not terrible.
- The biggest visible content arrives too late.
- The page is busy running JavaScript for too long.
- The layout is stable, so avoid risky layout rewrites.

## Pages And Flows To Measure

Measure these pages separately because each page has a different bottleneck:

- Home: `/`
- Store: `/store`
- Category: `/categories/[handle]`
- Collection: `/collections/[handle]`
- Product detail: `/products/[handle]`
- Visual search: `/search/visual`
- Cart: `/cart`
- Checkout address step: `/checkout?step=address`
- Checkout delivery/payment/review steps
- Wishlist: `/wishlist`
- Account dashboard: `/account`
- Account orders: `/account/orders`
- Order detail: `/account/orders/details/[id]`
- Admin dashboard: `/admin`
- Admin products: `/admin/products`
- Admin product detail: `/admin/products/[id]`
- Admin orders: `/admin/orders`
- Admin order detail: `/admin/orders/[id]`
- Admin home settings: `/admin/home-settings`
- Admin reviews: `/admin/reviews`

## What To Record For Each Page

Record these numbers:

- Lighthouse Performance score.
- FCP.
- LCP.
- TBT.
- CLS.
- Speed Index.
- Total transferred KB/MB from Chrome DevTools Network.
- Number of requests.
- Largest image or video URL.
- Largest JavaScript chunk.
- Third-party scripts loaded.
- Whether the page was tested logged out or logged in.
- Whether cache was disabled or enabled.

## Required Test Modes

Use these modes:

1. Production live site in incognito.
2. Production live site normal browser with cache.
3. Local production build if needed:

```bash
pnpm.cmd build
pnpm.cmd start
```

4. Admin logged-in browser for admin-only pages.

Do not compare a development server directly with production Lighthouse scores. Development mode includes extra scripts and slower behavior.

## Success Targets

Public pages:

- Performance score: 80+
- LCP: under 2.5s if possible
- TBT: under 200ms if possible
- CLS: below 0.1
- No single above-the-fold image should be multiple MB unless unavoidable.

Admin pages:

- Admin pages do not need perfect public Lighthouse scores.
- They should avoid loading all products, all orders, all media, or all videos at once.
- Admin interactions should not freeze the browser.

Checkout/cart:

- User actions should feel immediate.
- Do not sacrifice correctness for caching.
- Cart/checkout can stay dynamic because they contain user-specific data.

## Implementation Notes

Code changes should be minimal:

- Keep Vercel Speed Insights enabled if it is already used.
- Add a simple documentation template for before/after metrics.
- Do not add heavy monitoring libraries.
- Do not add extra analytics scripts only to measure performance.

## Manual Verification Steps

1. Open Chrome Incognito.
2. Go to `https://www.toycker.com`.
3. Open DevTools.
4. Go to Lighthouse.
5. Select Mobile.
6. Generate report.
7. Save the report or screenshot key metrics.
8. Repeat for Store, Product Detail, Cart, Checkout, and Admin pages.
9. Record values in a tracking doc before any implementation.

## What Not To Do

- Do not optimize based on one Lighthouse run only.
- Do not remove important checkout/cart logic just to improve score.
- Do not disable analytics permanently without business approval.
- Do not move customer-specific data into public caches.

## Sources

- Web.dev Core Web Vitals: https://web.dev/articles/vitals
- Web.dev LCP: https://web.dev/articles/optimize-lcp
- Web.dev INP: https://web.dev/articles/inp
- Chrome Lighthouse TBT: https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time
