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

## Hobby Plan Observability Limitation

On the Hobby plan, Vercel Observability only exposes a short recent time window for detailed route/path/bot views. Longer windows such as 24 hours, 3 days, 7 days, 14 days, and 30 days require an upgrade.

This means optimization work should use:

- the visible `Last 12 hours` data
- repeated screenshots from different times of day
- top routes available in Usage/Observability
- Logs, if available
- Firewall events, if available

It is not necessary to upgrade just to start optimizing. A 12-hour sample is enough to identify many high-impact problems if the same routes appear repeatedly.

## Initial 12-Hour Observability Findings

The available 12-hour Fast Data Transfer view already shows useful signals.

### Fast Data Transfer: Top Routes In 12 Hours

| Route | Requests | Transfer in | Transfer out | Total transfer | Initial interpretation |
| --- | ---: | ---: | ---: | ---: | --- |
| `/_next/image` | 5.1K | 8.97 MB | 258.42 MB | 267.39 MB | Main visible transfer source; image optimization and image delivery need attention |
| `/collections/[handle]` | 6.2K | 18.47 MB | 14.11 MB | 32.58 MB | Collection pages are high-traffic and currently force dynamic rendering |
| `/products/[handle]` | 1.3K | 3.28 MB | 17.69 MB | 20.97 MB | Product pages contribute meaningful transfer |
| `/404` | 2.6K | 3.29 MB | 9.17 MB | 12.47 MB | Repeated invalid paths or bot probing |
| `/_next/static/chunks/...js` | 180 | 289.81 KB | 11.37 MB | 11.66 MB | Static JS transfer; not the first priority |
| `/api/cache/telemetry` | 3K | 10.2 MB | 247.95 KB | 10.45 MB | Custom telemetry creates many requests/function invocations |
| `/store` | 1.6K | 4.58 MB | 5 MB | 9.58 MB | Public store page is a recurring route |
| `/categories/[...category]` | 2.2K | 7 MB | 1.59 MB | 8.59 MB | Category pages are high-traffic |
| `/assets/images/H373b3e2614344291824ff29116a86506M.jpg` | 258 | 486.12 KB | 7.39 MB | 7.87 MB | Static image transfer |
| `/_next/static/media/...ttf` | 130 | 185.96 KB | 7.6 MB | 7.78 MB | Font transfer; lower priority than APIs/images/bots |

In the same 12-hour window, Vercel shows approximately:

- Outgoing Fast Data Transfer: `2 GB`
- Incoming Fast Data Transfer: `136 MB`

If `2 GB per 12 hours` continued steadily, that would be roughly `120 GB per 30 days`, which is above the Hobby `100 GB` limit. This aligns with the dashboard showing the project near the monthly transfer limit.

### Suspicious Bot/Invalid Path Signals

The `Paths` and `Bot Name` tabs are partially gated by the Pro upgrade prompt, but visible rows show repeated requests to paths that do not appear to be real Toycker routes:

| Visible path | Requests in 12h | Notes |
| --- | ---: | --- |
| `/api/blog` | 12K | Not a known Toycker API route |
| `/blog/2` | 13K | Not a known Toycker route |
| `/blog/3` | 14K | Not a known Toycker route |
| `/api/demo` | 14K | Not a known Toycker API route |
| `/api/generate` | 12K | Not a known Toycker API route |
| `/blog/1` | 12K | Not a known Toycker route |

Visible bot names include:

- `Googlebot`
- `Baiduspider`
- `OpenAI`

This strongly suggests that bots and crawlers are consuming a meaningful number of Edge Requests. Even when each invalid request transfers only a small amount of data, the request count can quickly push the Hobby `1M Edge Requests` limit.

Immediate implication:

- Firewall/rate limiting/bot rules should be treated as a top priority.
- The `/404` route showing 2.6K requests in 12 hours supports the same conclusion.

## Confirmed Vercel Evidence From Additional Screenshots

The later Vercel screenshots provide stronger evidence about where usage is coming from.

### Fast Origin Transfer: Last 30 Days

Fast Origin Transfer is transfer between Vercel's CDN and Vercel Compute. This is already above the Hobby limit.

| Metric | Value |
| --- | ---: |
| Total Fast Origin Transfer | 12.22 GB |
| Incoming | 2.32 GB, 19.0% |
| Outgoing | 9.9 GB, 81.0% |

Top regions:

| Region | Transfer | Share |
| --- | ---: | ---: |
| Washington, D.C., USA, `iad1` | 7.06 GB | 57.8% |
| Mumbai, India, `bom1` | 4.55 GB | 37.2% |
| Singapore, `sin1` | 244.75 MB | 2.0% |
| Frankfurt, Germany, `fra1` | 188.5 MB | 1.5% |

Interpretation:

- The high outgoing origin transfer means Vercel Compute is repeatedly producing responses instead of serving everything from CDN cache.
- Washington, D.C. has the largest share, even though the business audience is likely India-focused. This may be related to default function/runtime region, image/cache infrastructure, bot traffic, or Vercel-managed infrastructure.
- The largest code-level fixes should reduce dynamic compute responses, especially Middleware and public dynamic pages.

### Edge Requests: Last 12 Hours

Vercel Observability shows `61K` Edge Requests in the visible 12-hour window.

Top routes:

| Route | Requests | Cached | Notes |
| --- | ---: | ---: | --- |
| `/collections/[handle]` | 6.6K | 0% | High request count and not cached |
| `/_next/image` | 5.1K | 77% | Major transfer source |
| `/api/cache/telemetry` | 3.2K | 0% | Custom telemetry is creating many requests |
| `/404` | 2.5K | 100% | Invalid path/bot traffic |
| `/products.json` | 2.4K | 0% | Suspicious/bot target; not a normal Toycker route |
| `/categories/[...category]` | 2.3K | 0% | Public category pages are not cached at the edge |
| `/store` | 1.7K | 0% | Public store page is not cached at the edge |
| `/products/[handle]` | 1.3K | 0% | Product pages are not cached at the edge |
| `/account` | 617 | 0% | Private/account route |
| `/manifest.webmanifest` | 607 | 97.7% | Good cache behavior |
| Web Analytics page view ingestion | 600 | 0% | Vercel analytics ingestion |
| `/cart` | 589 | 0% | Cart route |
| `/club` | 563 | 0% | Public route, likely cacheable |
| `/policies/[slug]` | 518 | 0% | Public route, likely cacheable |
| `/` | 472 | 45.1% | Homepage partly cached |

Interpretation:

- The biggest opportunity is not one route; it is a pattern: many public storefront routes are `0%` cached.
- `/collections/[handle]`, `/categories/[...category]`, `/store`, `/products/[handle]`, `/club`, and `/policies/[slug]` should be reviewed for static/ISR behavior.
- `/api/cache/telemetry` is a clear waste source because it adds thousands of uncached requests.
- `/products.json` is suspicious and should be blocked or handled cheaply.

### Edge Request User Agents

Top user agents in the 12-hour Edge Requests view include:

| User agent pattern | Requests | Cached | Notes |
| --- | ---: | ---: | --- |
| Chrome on Windows | 16K | 39.4% | Normal browser-like traffic or automated browser |
| HeadlessChrome | 8K | 99.3% | Automated crawling/scraping/testing signal |
| Android Chrome | 6.5K | 31.7% | Mobile traffic |
| Older Chrome on Windows | 4.7K | 100% | Could be cached bot/browser traffic |
| HeadlessChrome on Linux | 3.1K | 78% | Automated crawling/scraping/testing signal |
| `meta-externalagent` | 2.4K and 1.1K | mixed | Facebook/Meta crawler |
| Bytespider-compatible UA | 483 | 67.8% | ByteDance crawler |
| `facebookexternalhit` | 459 | 97.1% | Facebook preview crawler |

Interpretation:

- Headless browser traffic is significant.
- Social crawlers are present.
- Firewall/Bot Management is not optional if the goal is to stay under Hobby limits.

### Vercel Function Invocations: Last 30 Days

The project has exceeded the Hobby Function Invocations limit.

| Metric | Value |
| --- | ---: |
| Successful invocations | 1,069,472 |
| User error invocations | 2 |
| Total shown | 1,069,474 |

Invocation type split:

| Type | Invocations | Share |
| --- | ---: | ---: |
| Middleware | 556,351 | 52.0% |
| Function | 513,123 | 48.0% |

Interpretation:

- Middleware is the single largest confirmed invocation category.
- This validates narrowing `src/proxy.ts` as a top-priority code change.
- Function invocations are also high, so API routes and telemetry still need optimization.

### Function Duration

The `Vercel Functions -> Duration` view shows no data for non-Fluid duration.

Interpretation:

- The relevant compute meter for this project is Fluid Compute/Active CPU and invocation count, not the legacy non-Fluid duration chart.
- The lack of duration data does not mean functions are free; the invocation count is already over the Hobby limit.

### Edge Request CPU Duration: Last 30 Days

| Metric | Value |
| --- | ---: |
| Total Edge Request CPU Duration | 18m 8s |

Top regions:

| Region | CPU duration | Share |
| --- | ---: | ---: |
| Mumbai, India, `bom1` | 11m 14s | 62.0% |
| San Francisco, USA, `sfo1` | 1m 57s | 10.8% |
| Washington, D.C., USA, `iad1` | 1m 52s | 10.3% |
| Singapore, `sin1` | 58s | 5.4% |
| Portland, USA, `pdx1` | 53s | 4.9% |

Interpretation:

- Edge CPU is not the largest visible problem compared with Function Invocations, Fast Origin Transfer, and Fast Data Transfer.
- It still supports reducing Middleware scope because Middleware accounts for 52% of invocations.

### Image Optimization: Last 12 Hours

Image Optimization has clear waste from high quality settings and many image variants.

| Metric | Value |
| --- | ---: |
| Transformations in 12h | 517 |
| Image cache write units in 12h panel | 6.7K |
| Image cache read units in 12h panel | 3.9K |

Formats:

| Format | Transformations |
| --- | ---: |
| Source | 376 |
| WebP | 141 |

Qualities:

| Quality | Transformations |
| --- | ---: |
| 95 | 461 |
| 75 | 56 |

Top widths:

| Width | Transformations |
| --- | ---: |
| 828px | 54 |
| 640px | 47 |
| 256px | 45 |
| 1080px | 44 |
| 3840px | 40 |
| 1200px | 38 |
| 1920px | 36 |
| 2048px | 36 |
| 750px | 36 |
| 128px | 32 |
| 48px | 31 |
| 96px | 29 |
| 384px | 28 |

Top sources are mostly `cdn.toycker.in/products/...` and `cdn.toycker.in/uploads/...` product images. Some source images are large PNG files around `2 MB` to `3 MB`.

Interpretation:

- `quality={95}` is overused and accounts for most transformations.
- Very large widths such as `3840px`, `2048px`, and `1920px` are being generated.
- Some source product images are large PNGs; converting or uploading optimized JPEG/WebP/AVIF sources would reduce transformation and transfer cost.
- Product image handling is a real Vercel usage issue, not just a frontend polish issue.

### Image Cache Reads/Writes: Last 30 Days

| Metric | Value |
| --- | ---: |
| Image Cache Reads | 16,271 read units |
| Image Cache Writes | 67,491 write units |
| Main region | Washington, D.C., `iad1` |

Interpretation:

- The sudden image cache read/write activity around May 11-13 suggests a recent deployment or image behavior change caused many new cache entries.
- High write units usually mean many new variants were generated or existing cache was bypassed/missed.

### Data Cache: Last 30 Days

| Data Cache meter | Value |
| --- | ---: |
| Reads | 20,439 read units shown in sampled day; region view shows 25,135 read units in Washington, D.C. |
| Writes | 32,592 write units |
| Bandwidth transferred | 71.96 MB |
| Bandwidth written | 7.61 MB |
| Revalidations | 0 |

Interpretation:

- Data Cache bandwidth is small compared with Fast Data Transfer and Fast Origin Transfer.
- Data Cache is not the main cost driver.
- Zero revalidations means most cache churn is likely normal cache reads/writes, not manual/on-demand revalidation storms.

### Logs: Last Hour

Log searches show:

- `/api/storefront/products`: only 2 POST requests in the last hour.
- `/api/storefront/search`: no logs found in the last hour.
- `/_next/image`: no logs found in the last hour.
- `/assets/videos`: no logs found in the last hour.
- `/products/*`, `/categories/*`, and `/collections/*`: many repeated GET requests.
- One visible product page error:
  - `GET /products/turbo-blast-die-cast-car-lau...`
  - status `500`
  - message: `Error: The router state header was sent but could not be parsed...`

Interpretation:

- At the sampled time, product/category/collection page crawling is more visible than API crawling.
- Product/category/collection pages should be cached better and protected from aggressive crawlers.
- The product page `500` should be investigated separately because errors also consume function work and can harm SEO/user experience.

### Firewall State

Firewall traffic view shows:

| Metric | Value |
| --- | ---: |
| Past hour allowed requests | 5.1K |
| Denied requests | 5 |
| Bot Protection | Inactive |
| Custom Rules | 0 |
| Audit log | No firewall activity in selected period |

Top Firewall traffic:

| Category | Value |
| --- | --- |
| Top IP | `171.61.164.192`, India, 2.3K requests in past hour |
| Other top IPs | `152.59.33.209`, `42.108.196.97`, `54.241.116.104`, `91.207.174.9` |
| Top AS name | Bharti Airtel Ltd., 2.3K requests |
| Other AS names | Amazon.com, Reliance Jio, Vodafone Idea, M247 Europe |
| Top request path | `/products.json`, 386 requests |
| Second request path | `/api/cache/telemetry`, 380 requests |
| Other paths | `/store`, `/`, `/_next/image` |
| Top host | `www.toycker.com`, 3.6K requests |
| Preview/deployment host | `toycker-...vercel.app`, 1.1K and 242 requests |

Rules page shows:

- no IP blocking rules
- no custom rules
- Bot Protection off
- AI Bots off

Interpretation:

- Firewall is currently not protecting usage.
- A single IP generated thousands of allowed requests in one hour.
- Preview/deployment URLs are receiving traffic; consider protecting or redirecting them if they are not meant for public browsing.
- `/products.json` is a suspicious path and should be blocked or answered cheaply.

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

- Enable Bot Protection. The current Vercel screenshot shows Bot Protection is `Off`.
- Review traffic in the Firewall dashboard.
- Switch suspicious automated traffic to `Challenge`.
- Enable the AI Bots managed rule. The current Vercel screenshot shows AI Bots is `Off`.
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

Confirmed reason for this priority:

- Firewall allowed `5.1K` requests in the past hour.
- Bot Protection is inactive.
- Custom Rules count is `0`.
- One IP made `2.3K` requests in the past hour.
- HeadlessChrome appears as a top user agent with `8K` requests in the 12-hour Edge Requests view.
- `/products.json` received hundreds of requests despite not being a normal Toycker route.

Recommended immediate Firewall rules:

| Rule | Action | Why |
| --- | --- | --- |
| Path equals `/products.json` | Deny or 404 cheaply | Suspicious bot target, 386 requests in past hour |
| Path starts with `/blog` | Deny or 404 cheaply | Toycker does not appear to have public blog routes; seen with 12K+ requests |
| Path equals `/api/blog` | Deny | Not a known Toycker API route |
| Path equals `/api/demo` | Deny | Not a known Toycker API route |
| Path equals `/api/generate` | Deny | Not a known Toycker API route |
| AI Bots | Deny or Challenge | OpenAI and other crawlers were visible |
| Non-browser/bot protection | Challenge | HeadlessChrome traffic is high |

Use `Log` or `Challenge` first if there is concern about blocking legitimate users. For clearly fake routes such as `/api/demo`, `/api/generate`, and `/api/blog`, `Deny` is reasonable.

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

### 1. Narrow Proxy/Middleware Scope

Status: Implemented and manually verified on May 14, 2026

Implementation summary:

- `src/proxy.ts` was changed from a broad public-route matcher to a narrow matcher for `/checkout/:path*`, `/account/:path*`, and `/admin/:path*`.
- Public storefront routes such as `/`, `/store`, `/products/*`, `/collections/*`, `/categories/*`, `/club`, and `/policies/*` no longer run proxy.
- Payment callbacks remain outside proxy. Production and local `GET` checks for `/api/payu/callback` and `/api/easebuzz/callback` returned `200 OK`.
- No Supabase migration was required or created because this is a code-only route matcher change.

Relevant files:

- `src/proxy.ts`

Current behavior:

- Static assets are excluded, which is good.
- But the proxy still runs broadly across many public routes.
- It performs Supabase auth/session logic when auth cookies exist.

Confirmed Vercel evidence:

- Middleware accounts for `556,351` invocations in the last 30 days.
- This is `52.0%` of all Vercel Function invocations.
- Function invocations are already above the Hobby `1,000,000` limit.

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
- `/club`
- `/policies/*`

Source: [CDN pricing and usage](https://vercel.com/docs/manage-cdn-usage)

Expected impact: Very high for Function Invocations and Fast Origin Transfer.

### 2. Stop Global Layout API Calls For Anonymous Visitors

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

Confirmed Vercel evidence:

- `/api/cache/telemetry` had `3.2K` Edge Requests in the visible 12-hour window.
- `/api/cache/telemetry` had `0%` cached requests.
- Firewall traffic showed `/api/cache/telemetry` as the second top path in the past hour with `380` requests.
- Fast Data Transfer showed `/api/cache/telemetry` using `10.45 MB` total transfer in 12 hours.

Why this is expensive:

- Every custom telemetry beacon to `/api/cache/telemetry` is a function invocation.
- Web vitals can send multiple metrics per page view.
- If traffic is high, telemetry alone can consume a large number of invocations.

Recommended change:

- Disable custom telemetry in production, or
- sample only 1-5% of sessions, or
- keep Vercel Speed Insights and remove duplicate custom telemetry.

Expected impact: High for Function Invocations and Edge Requests.

### 4. Make Public Storefront Pages Cacheable With ISR

Relevant files:

- `src/app/(main)/collections/[handle]/page.tsx`
- `src/app/(main)/categories/[...category]/page.tsx`
- `src/app/(main)/store/page.tsx`
- `src/app/(main)/products/[handle]/page.tsx`
- `src/app/(main)/club/page.tsx`
- `src/app/(main)/policies/[slug]/page.tsx`

Confirmed Vercel evidence:

| Route | 12h requests | Cached |
| --- | ---: | ---: |
| `/collections/[handle]` | 6.6K | 0% |
| `/categories/[...category]` | 2.3K | 0% |
| `/store` | 1.7K | 0% |
| `/products/[handle]` | 1.3K | 0% |
| `/club` | 563 | 0% |
| `/policies/[slug]` | 518 | 0% |

Why this is expensive:

- Public product/category/collection traffic should mostly be served from CDN/ISR.
- `0%` cached on these public routes means Vercel is doing more work than necessary.
- Logs show repeated crawling of `/products/*`, `/categories/*`, and `/collections/*`.

Recommended changes:

- Remove unnecessary `force-dynamic` from public collection routes.
- Use `revalidate = 300` or `revalidate = 3600` where inventory freshness allows.
- Keep account/cart/checkout dynamic.
- Ensure public pages do not call `cookies()`, `headers()`, or user-specific data unless necessary.
- Avoid sending `set-cookie` from public page responses.

Expected impact: Very high for Edge Requests, Function Invocations, and Fast Origin Transfer.

### 5. Convert Public Product Listing API From Uncached POST To Cacheable GET

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

### 6. Reduce Image Optimization Usage

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

Confirmed Vercel evidence:

- `517` image transformations in the visible 12-hour window.
- `461` transformations used quality `95`.
- Only `56` transformations used quality `75`.
- Top image sources are mostly `cdn.toycker.in/products/...`.
- Some source images are `2 MB` to `3 MB` PNG files.
- Image Cache Writes are high at `67,491` write units in the visible 30-day view.

Recommended changes:

- Use default quality or `75` for product cards and thumbnails.
- Reserve `95` only for large hero/detail images where quality is visibly important.
- Use `unoptimized` for tiny icons, SVGs, logos, and images under roughly 10 KB.
- Limit image sizes/device sizes to what the design actually needs.
- Continue using long `minimumCacheTTL`; Toycker already uses a high value.
- Convert large PNG product images to JPEG/WebP before upload when transparency is not needed.
- Avoid generating very large image widths such as `3840px`, `2048px`, and `1920px` for product cards.

Source: [Managing Image Optimization Costs](https://vercel.com/docs/image-optimization/managing-image-optimization-costs)

Expected impact: Medium to high for Image Optimization and Fast Data Transfer.

### 7. Make Collection Detail Pages Cacheable

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

### 8. Keep Search Cached And Rate Limited

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

1. Enable Bot Protection and AI Bots controls.
2. Add deny rules for clearly fake routes:
   - `/products.json`
   - `/api/blog`
   - `/api/demo`
   - `/api/generate`
   - `/blog/*`
3. Add rate limiting or challenge rules for aggressive crawling of:
   - `/products/*`
   - `/categories/*`
   - `/collections/*`
4. Review top IPs in Firewall Traffic. A single IP generated `2.3K` requests in one hour, so IP-based blocking may be useful if abuse repeats.
5. Review whether preview/deployment hosts should be publicly crawlable. Firewall traffic shows `vercel.app` deployment hosts receiving requests.

### Phase 2: Remove Unnecessary Function Invocations

1. Narrow `src/proxy.ts` so Middleware only runs on auth-required routes.
2. Disable or sample custom telemetry.
3. Avoid `/api/storefront/layout-state` for anonymous users.
4. Avoid global shipping option fetches.
5. Investigate and fix the visible product page `500` error from logs.

### Phase 3: Cache Public Storefront Data

1. Make collection pages ISR instead of force-dynamic.
2. Review category, product, store, club, and policy pages for unnecessary dynamic rendering.
3. Convert public product listing from POST to GET if product/filter traffic remains high.
4. Add CDN cache headers to public API responses where safe.
5. Ensure public routes do not set cookies unnecessarily.

### Phase 4: Reduce Transfer And Image Usage

1. Reduce `quality={95}` usage, especially on product cards and thumbnails.
2. Convert large PNG product sources to JPEG/WebP when transparency is not needed.
3. Limit unnecessary large image widths.
4. Mark tiny/static assets as `unoptimized`.
5. Move MP4 videos away from Vercel if future transfer data shows `/assets/videos` usage.
6. Lazy-load or active-load homepage videos.

## Practical Priority Ranking

| Priority | Action | Expected impact |
| --- | --- | --- |
| 1 | Narrow proxy/middleware scope | Very high |
| 2 | Firewall bot protection, AI bot controls, fake-route deny rules | Very high |
| 3 | Disable or sample custom telemetry | High |
| 4 | Make public storefront pages ISR/cacheable | High |
| 5 | Avoid global layout-state API for anonymous visitors | High |
| 6 | Reduce `quality={95}` and image variant generation | Medium to high |
| 7 | Fix suspicious `/products.json` and repeated invalid paths | Medium to high |
| 8 | Convert public product API to cacheable GET if API usage remains high | Medium |
| 9 | Move videos/media off Vercel if future logs show video transfer | Medium |
| 10 | Small frontend/code cleanup | Low |

## Final Recommendation

For Toycker, the Free/Hobby plan can be optimized, but only by targeting the major usage drivers. The confirmed biggest issues are Middleware invocations, uncached public storefront routes, telemetry requests, image optimization variants, and missing Firewall/Bot rules.

The first code change should be narrowing `src/proxy.ts`, because Middleware is confirmed at `556,351` invocations, or `52.0%` of all invocations. The first Vercel configuration change should be enabling Bot Protection/AI Bot controls and adding custom rules for fake routes such as `/products.json`, `/api/blog`, `/api/demo`, `/api/generate`, and `/blog/*`.

If Toycker has real commercial traffic, these optimizations can reduce waste and delay limit exhaustion, but Hobby may still not be sustainable long term because the plan is designed for personal projects and small-scale applications.
