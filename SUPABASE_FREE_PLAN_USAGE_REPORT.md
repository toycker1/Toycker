# Supabase Free Plan Usage Report

## Context

Toycker is a Next.js, TypeScript, Tailwind CSS, and Supabase based toy shopping system.

The Supabase project is currently on the Free Plan. The Supabase dashboard shows a top-bar warning:

> Grace period is over

The Usage page also shows that Egress usage is relatively high for the current billing cycle.

From the supplied dashboard screenshot:

- Billing cycle: 25 Apr 2026 - 25 May 2026
- Plan: Free Plan
- Egress: 2.867 GB / 5 GB, about 57%
- Cached Egress: 0 GB / 5 GB
- Database Size: 0.039 GB / 0.5 GB, about 8%
- Monthly Active Users: 14 / 50,000
- Realtime Concurrent Peak Connections: 8 / 200
- Realtime Messages: 56 / 2,000,000
- Storage Size: 0 GB / 1 GB
- Edge Function Invocations: 0 / 500,000

The dashboard also states:

> You have not exceeded your Free Plan quota in this billing cycle.

So the project is currently not over quota in this cycle, but it has previously exceeded a Free Plan quota and the grace period for that previous event has ended.

## What "Grace period is over" Means

Supabase Free Plan projects are subject to fair-use limits. If a project exceeds a quota, Supabase may first give a grace period. During that period, the project can continue serving requests while the owner reduces usage or upgrades the plan.

When Supabase says "Grace period is over", it means:

- The project or organization previously exceeded a Free Plan quota.
- Supabase already allowed a temporary grace period.
- That grace period has now ended.
- If the project exceeds limits again, Supabase may restrict the project instead of giving another grace period.

Possible restrictions can include:

- API requests failing with a 402 status code.
- Project actions being blocked.
- Database entering restricted/read-only behavior.
- Project being paused depending on the limit and policy.

In simple terms:

> Supabase is warning that the project must now stay within Free Plan limits. If it crosses limits again, requests may stop working.

## What Egress Means

Egress means data leaving Supabase and going somewhere else.

For this project, egress can come from:

- Database query results sent from Supabase to the Next.js server.
- Database query results sent directly from Supabase to the browser.
- Auth/session responses.
- Supabase Storage file downloads.
- Realtime messages.
- Edge Function responses.
- Logs or other outgoing platform data.

Egress is not only images or files. Normal database reads also count.

Example:

If the storefront asks Supabase for 12 products, and each product includes variants, options, images, metadata, descriptions, and related products, all of that response data counts as egress.

## Why Egress Is High In This Project

Based on the screenshot and local code review, the main risk appears to be database egress, not Supabase Storage.

In the last 60 minutes screenshot:

- Database requests: 4,156
- Auth requests: 430
- Storage requests: 2
- Realtime requests: 3

This suggests that most Supabase traffic is coming from database/API reads.

### 1. Product Queries Return Too Much Data

The product data layer uses a very large select shape in `src/lib/data/products.ts`.

The current product select includes:

```ts
*,
variants:product_variants(*),
options:product_options(*, values:product_option_values(*)),
related_combinations:product_combinations!product_id(
  *,
  related_product:products!related_product_id(
    *,
    variants:product_variants(*),
    options:product_options(*, values:product_option_values(*))
  )
)
```

This is acceptable for a product detail page, but it is heavy for product listing pages.

For listing pages, product cards usually need only:

```ts
id,
name,
handle,
image_url,
price,
compare_at_price,
stock_count
```

When listing pages fetch product detail level data, every visitor browsing the store causes unnecessary egress.

### 2. Product Filtering Can Fetch Too Many Rows

In `src/lib/data/products.ts`, price filtering is done after fetching data when a price filter is active.

That means the app may fetch many products from Supabase and then filter them in the Next.js app.

This increases egress because Supabase sends more data than the user actually sees.

The better approach is to apply filtering in SQL or in a Supabase RPC/database function, then return only the current page of results.

### 3. Layout State Is Fetched With No Cache

The layout data provider calls:

```ts
fetch("/api/storefront/layout-state", {
  cache: "no-store",
})
```

This means the request is repeated instead of being cached.

That API route loads:

- customer data
- cart data

Cart loading can be heavy because it includes cart items, products, variants, promotions, shipping data, and settings.

For public visitors, most pages do not need a full cart and customer payload.

### 4. Cart Queries Include Full Product Data

In `src/lib/data/cart.ts`, cart retrieval includes:

```ts
items:cart_items(
  *,
  product:products(*),
  variant:product_variants(*)
),
promotion:promotions(*)
```

This can be heavy if called frequently. Full cart details are needed on cart and checkout pages, but not necessarily on every public storefront page.

### 5. Admin And Realtime Can Trigger Extra Refreshes

The admin area has realtime listeners such as:

- `src/modules/admin/components/realtime-orders-listener.tsx`
- `src/modules/admin/components/notifications/index.tsx`

Realtime usage is currently low, but realtime callbacks can trigger `router.refresh()`, which can re-run server queries.

This is acceptable for admin screens, but realtime should not be added broadly to public storefront pages unless absolutely required.

### 6. Auth Requests Also Add Usage

Auth requests are not the main issue, but they still contribute to traffic.

The screenshot shows 430 auth requests in the last 60 minutes. This can happen from repeated session checks, login flows, `getUser()` calls, and client-side auth state checks.

## What Is Probably Not Causing The Current Egress

Supabase Storage is probably not the main cause right now.

Evidence:

- Storage Size is 0 GB / 1 GB.
- Storage Requests are very low.
- Cached Egress is 0 GB.

The project also has many local assets under `public/assets`. Those are served by the Next.js hosting platform, not by Supabase Storage, unless they are separately uploaded and served from Supabase.

## Goal

The goal is to continue using only the Supabase Free Plan and avoid future quota issues.

The practical target should be:

> Keep egress below 3.5 GB to 4 GB per billing cycle, instead of waiting until it reaches 5 GB.

This gives a buffer before hitting the Free Plan limit.

## Recommended Actions

### Priority 1: Split Product Queries

Create separate query shapes:

1. Product card/list query
2. Product detail query

Product list/card pages should return only lightweight fields:

```ts
id,
name,
handle,
image_url,
price,
compare_at_price,
stock_count,
status
```

Product detail pages can return the full product:

```ts
product,
variants,
options,
option values,
related products,
reviews
```

Expected impact:

- Large reduction in database response size.
- Lower egress on homepage, collections, categories, search, and store pages.

### Priority 2: Enforce Database-Level Pagination

All product listing APIs should use `.range()` or `.limit()`.

Avoid this pattern:

```ts
fetch all products
filter in JavaScript
slice for current page
```

Use this pattern instead:

```ts
filter in SQL
sort in SQL
paginate in SQL
return only current page
```

Expected impact:

- Prevents large responses during search and filtering.
- Keeps storefront browsing predictable under Free Plan limits.

### Priority 3: Reduce Layout State Payload

The global layout should not fetch full cart/customer details on every page.

Recommended approach:

- If there is no cart cookie, do not query Supabase for cart.
- If the user is not logged in, do not query customer/profile data.
- In the global layout, fetch only a lightweight cart summary:

```ts
cart_id,
item_count,
subtotal
```

Fetch full cart details only on:

- cart page
- checkout page
- cart drawer when opened

Expected impact:

- Reduces repeated database reads on every page navigation.
- Especially useful for anonymous browsing traffic.

### Priority 4: Cache Public Storefront Data

Cache public data that does not change every second:

- home banners
- exclusive collections
- categories
- collections
- featured products
- best-selling products
- global settings
- shipping options

Recommended cache durations:

- categories/collections: 1 hour to 24 hours
- home banners: 1 hour
- global settings: 10 minutes to 1 hour
- featured products: 10 minutes to 1 hour

Expected impact:

- Reduces repeated Supabase reads.
- Protects Free Plan quota during normal browsing.

### Priority 5: Optimize Search

Search should:

- debounce client input
- require at least 2 or 3 characters before querying
- return only lightweight product-card fields
- limit results
- avoid searching on every keystroke without delay

Recommended behavior:

```txt
minimum query length: 2 or 3 characters
debounce: 300-500 ms
result limit: 8-20 products
```

Expected impact:

- Lower request count.
- Lower egress during active browsing.

### Priority 6: Keep Realtime Limited

Realtime should be used only where it provides real value.

Recommended usage:

- admin orders screen
- specific order status page
- admin notifications

Avoid:

- public product inventory realtime for all visitors
- broad subscriptions on high-traffic pages
- `event: "*"` when only `INSERT` or `UPDATE` is needed

Expected impact:

- Keeps realtime messages and connections low.
- Avoids unnecessary refresh-triggered queries.

### Priority 7: Reduce Auth Checks

Avoid repeated client-side auth checks in many components.

Recommended approach:

- Load auth/customer state once where needed.
- Pass minimal state down through props/context.
- Do not check auth on purely public pages unless necessary.

Expected impact:

- Reduces auth request count.
- Reduces small but repeated egress.

### Priority 8: Keep Media Outside Supabase Storage Or Optimize It

Current screenshots suggest Storage is not the issue.

If product images or videos are later moved to Supabase Storage:

- compress images before upload
- use WebP or AVIF
- use thumbnails in grids
- avoid serving original large images in product cards
- avoid autoplaying large videos from Supabase Storage
- use cacheable public URLs where appropriate

Expected impact:

- Prevents Storage bandwidth from becoming the next quota issue.

## Monitoring Plan

Check Supabase Usage at least weekly.

Watch these metrics:

- Egress
- Cached Egress
- Database requests
- Auth requests
- Storage requests
- Realtime messages
- Realtime peak connections
- Database size
- Storage size

If Egress increases quickly, investigate:

- Which pages were visited most.
- Which API routes were called most.
- Which Supabase queries return large payloads.
- Whether product listing pages are returning full product data.
- Whether cart/customer layout state is being fetched too often.

## Suggested Implementation Order

1. Add lightweight product list/card queries.
2. Move full `PRODUCT_SELECT` usage to product detail pages only.
3. Fix price filtering so it does not fetch all products.
4. Change layout state to skip Supabase calls when there is no cart/user.
5. Split lightweight cart summary from full cart details.
6. Add or confirm caching for homepage, categories, collections, and settings.
7. Review search debounce and result limits.
8. Keep realtime restricted to admin/order-specific pages.

## Simple Summary For Senior Review

The Supabase warning means the project previously exceeded a Free Plan quota and the grace period has ended. The project is currently not over quota in this billing cycle, but future quota breaches may cause restrictions or failed requests.

The main usage risk is Egress. Egress means data sent out from Supabase. In this project, the high egress is most likely from database responses, not Storage, because database requests are high and Storage usage is almost zero.

The biggest optimization opportunity is to reduce the amount of data returned by storefront queries. Product listing pages should return lightweight product-card data, while full product data should be fetched only on product detail pages. Cart/customer data should also not be fully fetched on every page load.

The project can remain on the Supabase Free Plan if it reduces database payload size, enforces pagination, caches public storefront data, limits realtime usage, and monitors egress throughout each billing cycle.

## References

- Supabase Egress documentation: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Supabase Billing documentation: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase Billing FAQ: https://supabase.com/docs/guides/platform/billing-faq
- Supabase Storage bandwidth documentation: https://supabase.com/docs/guides/storage/serving/bandwidth
