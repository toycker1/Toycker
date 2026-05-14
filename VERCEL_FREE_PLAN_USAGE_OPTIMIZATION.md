# Vercel Free Plan Usage Optimization Audit

Date: May 13, 2026

This document explains how Toycker can reduce usage on the Vercel Free/Hobby plan. It focuses on changes that can create meaningful impact, not small code cleanups that would barely affect Vercel usage.

## Current Situation

The Toycker site is live and running, but the Vercel dashboard shows that several Hobby plan usage meters are already exceeded or close to the limit.

The important meters are:

| Vercel meter | What it means | Why it matters |
| --- | --- | --- |
| Edge Requests | Every request processed by Vercel CDN | HTML, JS, CSS, images, API calls, bots, crawlers |
| Function Invocations | Requests that execute Vercel Functions | API routes, server-rendered routes, callbacks, telemetry |
| Fluid Active CPU | Actual CPU time used by server code | Dynamic routes, API logic, JSON processing, image/search work |
| Fast Origin Transfer | Data between Vercel CDN and compute | Function responses, middleware/proxy, SSR/ISR output |
| Fast Data Transfer | Data from Vercel CDN to visitors | Images, videos, JS, CSS, HTML, fonts |
| Image Optimization | Vercel image transformations/source images | `next/image` transformations and cache misses |

Vercel Hobby is a free tier intended for personal and small-scale projects. For a live ecommerce site, the free limits can be reached quickly even when the website works correctly.

Official Vercel Hobby limits include:

| Resource | Hobby included usage |
| --- | ---: |
| Active CPU | 4 CPU-hours |
| Provisioned Memory | 360 GB-hours |
| Function Invocations | 1,000,000 |
| Edge Requests | 1,000,000 |
| Fast Data Transfer | 100 GB |
| Fast Origin Transfer | 10 GB |
| Speed Insights Data Points | 10,000 |
| Web Analytics Events | 50,000 |

Source: [Vercel Hobby Plan](https://vercel.com/docs/accounts/plans/hobby)

## Main Conclusion

Meaningful Vercel Free plan optimization needs both:

1. Vercel dashboard/configuration changes
2. Code changes

Small frontend refactors, minor CSS cleanup, icon changes, or removing a few unused imports will not solve this problem. The real savings come from reducing the number of requests that hit Vercel Functions, reducing uncached dynamic routes, reducing media transfer, reducing image transformations, and blocking unnecessary bot/crawler traffic.

## Highest Impact Non-Code Changes

### 1. Enable Vercel Firewall Bot Protection

This is likely one of the highest-impact actions if bots or crawlers are consuming traffic.

Bots can crawl product pages, category pages, collection pages, search URLs, and API routes very aggressively. These requests count against Edge Requests, Fast Data Transfer, and sometimes Function Invocations.

Recommended actions:

- Enable Bot Protection in `Log` mode first.
- Review traffic in the Firewall dashboard.
- Switch suspicious automated traffic to `Challenge`.
- Enable the AI Bots managed ruleset.
- Set AI Bots to `Deny` if AI crawlers are not useful for the business.
- Add rate limits for high-risk paths:
  - `/api/storefront/search`
  - `/api/storefront/products`
  - `/api/storefront/search/image`
  - `/products/*`
  - `/categories/*`
  - `/collections/*`

Vercel docs confirm that rate limiting helps control repeated requests from the same source and gives better control over usage costs.

Sources:

- [WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
- [WAF Managed Rulesets](https://vercel.com/docs/vercel-waf/managed-rulesets)
- [DDoS Mitigation](https://vercel.com/docs/vercel-firewall/ddos-mitigation)

Expected impact: Very high if traffic includes bots, crawlers, scrapers, or repeated automated requests.

### 2. Use Vercel Usage And Observability Before Guessing

Before making code changes, inspect the actual top usage paths.

In Vercel:

1. Open the correct team/project.
2. Go to `Usage`.
3. Select `Last 30 days`.
4. Filter to the Toycker project.
5. Open each high meter:
   - Edge Requests
   - Function Invocations
   - Fast Data Transfer
   - Fast Origin Transfer
   - Image Optimization
6. Check top paths, top functions, regions, and spikes.

This tells whether the biggest issue is:

- bots
- product/category pages
- search API
- image optimization
- videos/static media
- telemetry
- middleware/proxy
- cart/layout APIs

Source: [Manage and optimize usage](https://vercel.com/docs/limits/usage)

Expected impact: High, because it prevents wasting effort on low-impact changes.

### 3. Move Large Videos And Media Away From Vercel

Toycker currently has multiple MP4 files inside `public/assets/videos`. Several are around 1.7 MB to 2.8 MB each.

Examples:

- `public/assets/videos/exclusive-1.mp4`
- `public/assets/videos/exclusive-5.mp4`
- `public/assets/videos/exclusive-6.mp4`
- `public/assets/videos/exclusive-10.mp4`

Vercel Fast Data Transfer measures data sent from Vercel CDN to visitors. If videos are served through Vercel, transfer usage rises quickly.

Recommended actions:

- Move videos to Cloudflare R2 + Cloudflare CDN, Bunny CDN, Cloudinary, or Mux.
- Keep only lightweight poster images on Vercel.
- Avoid autoplaying multiple videos at the same time.
- Load video only when the card is visible or active.
- Use compressed WebM/MP4 variants.

Relevant file:

- `src/modules/home/components/exclusive-collections/index.tsx`

Source: [CDN pricing and usage](https://vercel.com/docs/manage-cdn-usage)

Expected impact: Very high for Fast Data Transfer.

## Highest Impact Code Changes

### 1. Stop Global Layout API Calls For Anonymous Visitors

Relevant files:

- `src/app/storefront-providers.tsx`
- `src/modules/layout/context/layout-data-context.tsx`
- `src/app/api/storefront/layout-state/route.ts`
- `src/app/api/storefront/shipping-options/route.ts`

Current behavior:

- `StorefrontProviders` wraps the full storefront.
- `LayoutDataProvider` runs on public pages.
- It fetches `/api/storefront/layout-state` with `cache: "no-store"`.
- Shipping options can also be loaded with `cache: "no-store"`.

Why this is expensive:

- Every public page view can create a function invocation.
- Anonymous visitors with no cart/auth still hit server code.
- Bots and crawlers also trigger the same calls.
- `no-store` prevents useful caching.

Recommended change:

- Before calling `/api/storefront/layout-state`, check whether the browser has a cart/auth-related cookie.
- If no cart cookie and no auth cookie exists, return local anonymous state without calling the API.
- Load cart/customer only when cart, checkout, account, or header cart UI actually needs it.
- Load shipping options only in cart/checkout flows, not globally.

Expected impact: Very high for Function Invocations and Fast Origin Transfer.

### 2. Convert Public Product Listing API From Uncached POST To Cacheable GET

Relevant files:

- `src/app/api/storefront/products/route.ts`
- `src/modules/store/context/storefront-filters.tsx`

Current behavior:

```ts
export const dynamic = "force-dynamic"
```

The frontend uses:

```ts
fetch("/api/storefront/products", {
  method: "POST",
  cache: "no-store",
})
```

Why this is expensive:

- POST responses are not useful for CDN caching.
- `no-store` prevents caching.
- `force-dynamic` forces runtime work.
- Product/category/listing traffic can be high on an ecommerce site.

Recommended change:

Create a cacheable GET endpoint for public product listing:

```txt
GET /api/storefront/products?page=1&sortBy=featured&categoryId=...
```

Return cache headers:

```txt
Cache-Control: public, s-maxage=300, stale-while-revalidate=600
```

Use POST only for private or mutation-based operations.

Vercel CDN cache requirements include:

- request method must be `GET` or `HEAD`
- response must not be `private`, `no-cache`, or `no-store`
- response must not include `set-cookie`
- response should be under cacheable size limits

Sources:

- [Vercel CDN Cache](https://vercel.com/docs/cdn-cache)
- [Cache-Control headers](https://vercel.com/docs/headers/cache-control-headers)

Expected impact: Very high for storefront browsing traffic.

### 3. Remove Or Sample Custom Telemetry

Relevant files:

- `src/components/web-vitals-reporter.tsx`
- `src/instrumentation-client.ts`
- `src/app/api/cache/telemetry/route.ts`
- `src/lib/analytics/site-analytics-inner.tsx`

Current behavior:

Toycker uses several analytics/monitoring systems:

- custom `WebVitalsReporter`
- custom `navigator.sendBeacon("/api/cache/telemetry")`
- Vercel Analytics
- Vercel Speed Insights
- Sentry
- optional GTM, Meta Pixel, Contentsquare

Why this is expensive:

- Every custom telemetry beacon to `/api/cache/telemetry` is a function invocation.
- Web vitals can send multiple metrics per page view.
- If traffic is high, telemetry alone can consume a large number of invocations.

Recommended change:

- Disable custom telemetry in production, or
- sample only 1-5% of sessions, or
- keep Vercel Speed Insights and remove duplicate custom telemetry.

Expected impact: High for Function Invocations.

### 4. Reduce Image Optimization Usage

Relevant file:

- `next.config.js`

Current config:

```js
const IMAGE_QUALITIES = [75, 85, 95, 100]
```

Several components use:

```tsx
quality={95}
```

Why this is expensive:

- More quality values can create more transformation variants.
- `quality={95}` increases output file size.
- Product grids and thumbnails do not usually need 95 quality.
- Image Optimization quota can be consumed by unnecessary transformations.

Recommended changes:

- Use default quality or `75` for product cards and thumbnails.
- Reserve `95` only for large hero/detail images where quality is visibly important.
- Use `unoptimized` for tiny icons, SVGs, logos, and images under roughly 10 KB.
- Limit image sizes/device sizes to what the design actually needs.
- Continue using long `minimumCacheTTL`; Toycker already uses a high value.

Source: [Managing Image Optimization Costs](https://vercel.com/docs/image-optimization/managing-image-optimization-costs)

Expected impact: Medium to high for Image Optimization and Fast Data Transfer.

### 5. Narrow Proxy/Middleware Scope

Relevant file:

- `src/proxy.ts`

Current behavior:

- Static assets are excluded, which is good.
- But the proxy still runs broadly across many public routes.
- It performs Supabase auth/session logic when auth cookies exist.

Why this matters:

Vercel docs explain that Middleware/Proxy can add Fast Origin Transfer, and middleware should only run when necessary.

Recommended change:

Restrict proxy to routes that truly need auth/session checks:

- `/checkout`
- `/account`
- `/admin`
- auth callback paths where needed

Avoid running proxy for normal anonymous storefront browsing:

- `/`
- `/products/*`
- `/categories/*`
- `/collections/*`
- `/store`
- `/about`
- `/contact`

Source: [CDN pricing and usage](https://vercel.com/docs/manage-cdn-usage)

Expected impact: Medium to high, depending on public traffic volume.

### 6. Make Collection Detail Pages Cacheable

Relevant file:

- `src/app/(main)/collections/[handle]/page.tsx`

Current behavior:

```ts
export const dynamic = "force-dynamic"
```

But the page also has `generateStaticParams()`, which suggests it can be statically generated or ISR-cached.

Recommended change:

Use ISR:

```ts
export const revalidate = 300
```

or:

```ts
export const revalidate = 3600
```

Then rely on revalidation when admin collection data changes.

Expected impact: Medium to high if collection pages get traffic.

### 7. Keep Search Cached And Rate Limited

Relevant files:

- `src/app/api/storefront/search/route.ts`
- `src/modules/layout/hooks/useSearchResults.ts`

Current behavior:

Search already has a CDN cache header:

```txt
Cache-Control: public, s-maxage=30, stale-while-revalidate=120
```

This is good, but search can still be abused by bots and repeated typing.

Recommended changes:

- Increase cache to `s-maxage=300` if acceptable.
- Keep debounce on the client.
- Add Vercel Firewall rate limiting for the search endpoint.
- Add stricter limits for image search uploads.

Expected impact: Medium to high if search is a top path.

## Lower Impact Changes

These may improve code quality or frontend performance, but they should not be treated as the main Vercel Free plan fix:

- minor CSS cleanup
- icon changes
- small React component refactors
- removing a few unused imports
- changing button styles
- small admin UI cleanup
- tiny JavaScript bundle reductions unless Vercel shows JS as top transfer usage

## Recommended Implementation Order

### Phase 1: Measure And Block Waste

1. Open Vercel Usage for the last 30 days.
2. Identify top paths for:
   - Function Invocations
   - Edge Requests
   - Fast Data Transfer
   - Fast Origin Transfer
   - Image Optimization
3. Enable Bot Protection in log mode.
4. Enable AI Bots ruleset in log mode.
5. Add rate limiting for search and product APIs.
6. After confirming traffic patterns, switch suspicious bot traffic to challenge/deny.

### Phase 2: Remove Unnecessary Function Invocations

1. Disable or sample custom telemetry.
2. Avoid `/api/storefront/layout-state` for anonymous users.
3. Avoid global shipping option fetches.
4. Narrow proxy scope to auth-required routes.

### Phase 3: Cache Public Storefront Data

1. Convert public product listing from POST to GET.
2. Add CDN cache headers.
3. Make collection pages ISR instead of force-dynamic.
4. Review category/product pages for unnecessary dynamic rendering.

### Phase 4: Reduce Transfer And Image Usage

1. Move MP4 videos away from Vercel.
2. Lazy-load or active-load homepage videos.
3. Reduce `quality={95}` usage.
4. Mark tiny/static assets as `unoptimized`.
5. Review Image Optimization top sources in Vercel Observability.

## Practical Priority Ranking

| Priority | Action | Expected impact |
| --- | --- | --- |
| 1 | Firewall bot protection and rate limiting | Very high |
| 2 | Avoid global layout-state API for anonymous visitors | Very high |
| 3 | Convert public product API to cacheable GET | Very high |
| 4 | Move videos/media off Vercel | Very high |
| 5 | Disable/sample custom telemetry | High |
| 6 | Narrow proxy scope | Medium to high |
| 7 | Reduce image transformation variants | Medium to high |
| 8 | Make collection pages ISR | Medium to high |
| 9 | Small frontend/code cleanup | Low |

## Final Recommendation

For Toycker, the Free/Hobby plan can be optimized, but only by targeting the major usage drivers. The most important code changes are related to `no-store`, `force-dynamic`, global API calls, telemetry, product API caching, and media loading. The most important non-code changes are Vercel Firewall rules and moving heavy videos/media away from Vercel.

If Toycker has real commercial traffic, these optimizations can reduce waste and delay limit exhaustion, but Hobby may still not be sustainable long term because the plan is designed for personal projects and small-scale applications.

