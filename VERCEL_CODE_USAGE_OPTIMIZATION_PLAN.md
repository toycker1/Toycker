# Vercel Code Usage Optimization Plan

This document explains the code-related changes that should be made to reduce Toycker's Vercel Hobby plan usage. It is based on the current codebase, the existing `VERCEL_FREE_PLAN_USAGE_OPTIMIZATION.md`, and the Vercel usage screenshots.

## Main Finding

The biggest code-side waste is not one single image or one single product page. The largest confirmed code-side problems are:

1. `src/proxy.ts` runs middleware for too many public routes.
2. custom telemetry sends requests to `/api/cache/telemetry`.
3. some public pages are dynamic or behave like dynamic pages.
4. global layout data loads API state for visitors who may not need it.
5. image optimization was previously generating many Vercel image cache writes and transformations.

The goal is to reduce Vercel usage meaningfully, not make tiny changes that do not affect the limit.

## Priority 1: Narrow The Proxy Middleware Scope

### Evidence

Vercel shows:

```text
Middleware invocations: 556,351
Function invocations: 513,123
Middleware share: about 52%
```

That means more than half of the function invocation count is coming from middleware/proxy execution.

### Current File

```text
src/proxy.ts
```

### Current Problem

The current matcher excludes static assets, images, and some callback routes, but it still matches almost every normal public page:

```text
/
/store
/products/...
/collections/...
/categories/...
/club
/policies/...
```

For most anonymous storefront visits, this middleware does very little useful work. It checks cookies, may refresh Supabase auth, and only protects `/checkout`.

### Recommended Change

Change the proxy matcher so it only runs where auth/session behavior is actually needed.

Recommended first matcher:

```ts
export const config = {
  matcher: [
    "/checkout/:path*",
    "/account/:path*",
    "/admin/:path*",
  ],
}
```

If admin protection is handled somewhere else and does not need this proxy, `/admin/:path*` can be removed. If account pages need session refresh, keep `/account/:path*`.

### Why This Is High Impact

This should remove middleware execution from the highest-traffic public pages:

- `/collections/[handle]`
- `/products/[handle]`
- `/categories/[...category]`
- `/store`
- `/club`
- `/policies/[slug]`
- `/`

This is one of the few code changes that can significantly reduce Vercel function invocation usage.

### Required Tests

After changing `src/proxy.ts`, test:

- anonymous `/checkout` redirects to login,
- logged-in `/checkout` works,
- `/account` works for logged-in users,
- `/admin` still protects admin pages,
- payment callbacks still work,
- public product/category/collection pages still load,
- Vercel middleware invocations drop after deployment.

## Priority 2: Disable Or Sample Custom Telemetry

### Evidence

Vercel shows `/api/cache/telemetry` as a top route:

```text
/api/cache/telemetry - about 3.2K requests in the visible 12 hour Edge Requests view
```

The current code sends custom web-vitals telemetry even though Vercel Analytics and Speed Insights are also enabled.

### Current Files

```text
src/components/web-vitals-reporter.tsx
src/instrumentation-client.ts
src/lib/analytics/site-analytics-inner.tsx
src/app/api/cache/telemetry/route.ts
```

### Current Problem

There are duplicate telemetry sources:

- `WebVitalsReporter` sends metrics to `/api/cache/telemetry`.
- `instrumentation-client.ts` also sends web-vitals and navigation metrics to `/api/cache/telemetry`.
- `site-analytics-inner.tsx` also loads Vercel Analytics and Speed Insights in production.
- `/api/cache/telemetry/route.ts` accepts telemetry but does not store useful production data.

This creates extra requests without enough value.

### Recommended Change

For the Hobby plan, disable custom production telemetry.

Recommended approach:

1. Remove `WebVitalsReporter` from `src/lib/analytics/site-analytics-inner.tsx`.
2. Disable production beacon sending in `src/instrumentation-client.ts`.
3. Keep Vercel Analytics and Speed Insights only if their Vercel usage cost is acceptable.
4. Keep `/api/cache/telemetry/route.ts` only as a disabled or development-only endpoint.

Example behavior:

```ts
const ENABLE_CUSTOM_TELEMETRY =
  process.env.NEXT_PUBLIC_ENABLE_CUSTOM_TELEMETRY === "true"

if (!ENABLE_CUSTOM_TELEMETRY) {
  return
}
```

### Optional Sampling

If telemetry must remain enabled, sample it.

Use a very small sample rate:

```text
1% to 5%
```

Do not send every metric for every visitor.

### Why This Is High Impact

This directly reduces:

- Edge Requests,
- Function Invocations,
- request traffic to `/api/cache/telemetry`,
- noise in logs and observability.

## Priority 3: Make Public Storefront Pages Cache Correctly

### Evidence

Vercel shows many public routes with `0%` cached:

```text
/collections/[handle] - 0% cached
/categories/[...category] - 0% cached
/store - 0% cached
/products/[handle] - 0% cached
/club - 0% cached
/policies/[slug] - 0% cached
```

Public storefront pages should not behave like fully dynamic pages unless they show user-specific data.

### Important Files

```text
src/app/(main)/collections/[handle]/page.tsx
src/app/(main)/categories/[...category]/page.tsx
src/app/(main)/products/[handle]/page.tsx
src/app/(main)/store/page.tsx
src/app/(main)/club/page.tsx
src/app/(main)/policies/[slug]/page.tsx
src/lib/supabase/server.ts
src/lib/data/club.ts
src/lib/data/customer.ts
```

### Collection Page

Current issue:

```ts
export const dynamic = "force-dynamic"
```

This forces dynamic rendering for `/collections/[handle]`.

Recommended change:

```ts
export const revalidate = 300
```

or:

```ts
export const revalidate = 3600
```

Then remove:

```ts
export const dynamic = "force-dynamic"
```

Use `300` seconds if product changes need to appear quickly. Use `3600` seconds if lower Vercel usage is more important.

### Club Page

Current issue:

```text
src/app/(main)/club/page.tsx
```

This page calls customer/auth logic on the server:

```text
retrieveCustomer()
```

That can make the whole public club page dynamic.

Recommended change:

- keep the public club content static or ISR,
- move member/customer-specific status into a client component,
- load private member data only when needed.

### Policies Page

Policy pages are local static content. They should not need dynamic work.

Recommended change:

- add `generateStaticParams`,
- add `dynamic = "force-static"` or long `revalidate`,
- make sure no cookie-based helper is called.

### Product, Category, And Store Pages

These already use `revalidate = 60`, but Vercel still shows low or zero cache on some routes.

If they remain uncached after middleware is narrowed, check for server helpers that call:

```text
cookies()
headers()
auth helpers
Supabase SSR client with cookies
```

### Public Supabase Client Recommendation

The current server Supabase helper uses cookies:

```text
src/lib/supabase/server.ts
```

For public product, category, collection, and settings reads, create a no-cookie public server client.

Example target:

```text
src/lib/supabase/public-server.ts
```

Use it only for public read data where Row Level Security allows public reads.

This prevents public pages from becoming dynamic just because a helper touched request cookies.

## Priority 4: Stop Loading Global Layout Data For Every Anonymous Visitor

### Evidence

The app has a global storefront provider:

```text
src/app/storefront-providers.tsx
```

It includes:

```text
LayoutDataProvider
CartStoreProvider
ShippingPriceProvider
WishlistProvider
```

The layout data provider calls:

```text
/api/storefront/layout-state
```

from:

```text
src/modules/layout/context/layout-data-context.tsx
```

### Current Problem

Every visitor may trigger layout/cart/shipping state APIs even if they only view a public product or collection page.

### Recommended Change

Only fetch layout state when there is a real reason:

- user has an auth cookie,
- user has a cart cookie,
- user opens cart,
- user enters checkout,
- user opens account-related UI.

For anonymous users with no cart and no auth cookie, skip the API call.

### Example Logic

In the client provider, check whether browser cookies suggest cart or auth state exists before calling the layout API.

Pseudo behavior:

```ts
const hasLikelySession =
  document.cookie.includes("sb-") ||
  document.cookie.includes("toycker_cart")

if (!hasLikelySession) {
  setState(defaultAnonymousLayoutState)
  return
}
```

The exact cookie names should be verified before implementation.

### Why This Helps

This reduces API requests for anonymous page views. It also reduces function invocations and server work.

## Priority 5: Keep Image Optimization Disabled Or Reduce Variants

### Current State

The current `next.config.js` has:

```js
images: {
  unoptimized: true
}
```

That means Next Image should serve media directly instead of using Vercel Image Optimization.

### Why This Matters

Vercel previously showed:

```text
Image Optimization transformations: 517 in 12 hours
Image Cache Reads: 16,271
Image Cache Writes: 67,491
```

The screenshots also showed many transformations at different widths and quality `95`.

### Recommended Change

Keep `images.unoptimized = true` while staying on the Hobby plan.

Then monitor:

- `Usage > Image Optimization`
- `Image Cache Reads`
- `Image Cache Writes`
- `/_next/image` requests

If image optimization still appears after deployment, verify that the latest deployment is actually using the current `next.config.js`.

### Optional Cleanup

Many components still contain `quality={95}`. With `unoptimized: true`, that prop does not reduce Vercel image usage because Vercel optimization is bypassed. But it can confuse future maintenance.

If image optimization is ever re-enabled, reduce product-card quality to:

```text
75 or 80
```

Keep higher quality only for hero or gallery images where it is truly needed.

## Priority 6: Fix Or Remove `/products.json`

### Evidence

Vercel shows:

```text
/products.json - top Firewall and Edge Request path
```

This looks like crawler or bot traffic, not a real Toycker route.

### Best Fix

Block it in Vercel Firewall first.

### Code Fix Is Lower Priority

Adding a Next.js route for `/products.json` would still let the request reach the app. That is worse than blocking at the edge.

Only add a code route if there is a real product feed requirement.

## Priority 7: Convert Product Listing API To Cacheable GET If Needed

### Current Files

```text
src/app/api/storefront/products/route.ts
src/modules/store/context/storefront-filters.tsx
```

### Current Behavior

The frontend sends:

```text
POST /api/storefront/products
cache: no-store
```

The route is:

```ts
export const dynamic = "force-dynamic"
```

### Current Priority

This is not the first code change because the Vercel logs did not show `/api/storefront/products` as the largest current source. But it can become important if store filtering/search traffic grows.

### Recommended Future Change

Convert public product listing requests to GET query parameters:

```text
/api/storefront/products?page=1&sortBy=created_at&categoryId=...
```

Then add cache headers where safe:

```text
Cache-Control: public, s-maxage=300, stale-while-revalidate=600
```

Keep POST only for private or complex cases that cannot be cached.

## Priority 8: Fix The Product Page 500 Error

### Evidence

Vercel logs showed one product page error:

```text
GET /products/turbo-blast-die-cast-car-...
500
Error: The router state header was sent but could not be parsed.
```

### Why It Matters

Errors create extra retries, bad user experience, and wasted compute.

### Recommended Action

Investigate that product handle and confirm:

- the product exists,
- the product route handles missing data safely,
- page props and metadata do not throw,
- the issue is not caused by malformed crawler requests.

This is not the biggest usage driver, but it should be fixed.

## Priority 9: Use A Practical Deployment And Measurement Loop

Do not make all changes blindly at once. Apply the high-impact changes in phases.

### Phase 1

Code changes:

- narrow `src/proxy.ts`,
- disable or sample custom telemetry.

Expected impact:

- lower middleware invocations,
- lower function invocations,
- fewer `/api/cache/telemetry` requests.

### Phase 2

Code changes:

- remove `force-dynamic` from collections,
- make club public content static/ISR,
- make policies force-static or static params,
- verify public Supabase reads do not touch cookies.

Expected impact:

- better cache rate on public pages,
- lower Fast Origin Transfer,
- lower server work for repeated page visits.

### Phase 3

Code changes:

- skip layout-state API for anonymous visitors,
- lazy-load cart/shipping/account state.

Expected impact:

- fewer API invocations from public browsing.

### Phase 4

Code changes:

- convert product listing API from POST/no-store to cacheable GET if usage remains high,
- clean up image quality props if image optimization is re-enabled.

Expected impact:

- lower API cost during browsing/filtering,
- fewer image variants if optimization returns.

## Recommended First Code Changes

Start with these two changes because they are clearly tied to large usage numbers:

```text
1. Narrow src/proxy.ts matcher.
2. Disable or sample custom telemetry to /api/cache/telemetry.
```

Then deploy and check Vercel usage before doing deeper rendering changes.

## What Not To Spend Time On First

Do not start with these as the first fixes:

- minor CSS changes,
- reducing a few image qualities while `images.unoptimized` is already true,
- small component refactors,
- changing Data Cache logic, because Data Cache usage is not the main problem,
- adding a `/products.json` route in code, because Firewall is better for that path.

## Success Criteria

The code work is successful only if Vercel usage changes visibly.

After deployment, check:

- Middleware invocations should drop.
- `/api/cache/telemetry` should disappear or become very small.
- public storefront route cache percentage should improve.
- Function Invocations should fall below the Hobby limit trend.
- Fast Origin Transfer should grow more slowly.
- Image Optimization should stay low if `images.unoptimized` remains enabled.

If these numbers do not improve, the next investigation should focus on Vercel Observability top paths, user agents, and whether public routes are still being forced dynamic by cookie/auth helpers.
