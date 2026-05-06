# Remaining Risk: Bots, Crawlers, Prefetch, And Public Traffic

## Classification

`code-only`

No Supabase migration is required now.

## Why This Risk Remains

Even optimized pages can create high egress if they are requested too often.

This can happen from:

- search engine crawlers
- social preview bots
- uptime checkers
- aggressive browser prefetch
- repeated manual refreshes during testing
- malicious or accidental traffic spikes

## Current Evidence

Public routes still include dynamic pages and API routes:

- `/store`
- `/products/[handle]`
- `/collections/[handle]`
- `/categories/[...category]`
- `/api/storefront/products`
- `/api/storefront/search`
- `/api/storefront/search/image`
- `/api/storefront/layout-state`

The app already uses caching for important public content, but dynamic user-specific routes must stay dynamic.

## Git History To Check First

Before changing robots, sitemap, public route caching, link prefetching, or rate limiting, inspect Git history for storefront caching and request-reduction work:

```powershell
git log --oneline -- src/app src/modules/store src/modules/layout src/lib/data/products.ts src/lib/data/search.ts
git log --oneline -- supabase-free-plan-priorities/06-public-storefront-caching.md supabase-free-plan-priorities/07-search-request-and-payload-optimization.md supabase-free-plan-priorities/09-auth-request-reduction.md
git show --stat <relevant-commit>
```

This is important because priorities 6, 7, and 9 already reduced repeated public reads, search requests, and anonymous auth checks. Do not disable useful public caching or SEO pages without evidence.

## What Is Already Good

- Storefront listing payloads are lighter.
- Storefront pagination is bounded.
- Search is debounced and capped.
- Layout state is summary-only.
- Product/media delivery does not use Supabase Storage.
- Public homepage/category/settings data has caching.

## What Can Still Increase Egress

- Bots crawling all product pages.
- Bots hitting search endpoints.
- Repeated requests to dynamic API routes.
- `router.refresh()` or client behavior causing repeated data reloads.
- Public traffic growth.

## Recommended Action

Code-only changes only if monitoring shows bot/public endpoint pressure:

1. Confirm `robots.txt` blocks endpoints that should not be crawled.
2. Keep API routes out of sitemap.
3. Avoid prefetching heavy product detail pages unnecessarily.
4. Consider disabling prefetch on high-card product grids if it causes too many background requests.
5. Add basic rate limiting at the app or hosting layer for expensive API routes.
6. Keep `/api/storefront/search/image` protected by file size and request limits.

## Implementation Trigger

Only implement this file if one of these is true:

- Supabase logs show many anonymous repeated requests.
- Vercel/hosting logs show crawlers hitting product/search/API routes heavily.
- Egress rises without matching real user activity.
- Store pages trigger unexpected background requests during hover/scroll.
- Search endpoints are being called by non-browser clients.

If traffic is normal customer traffic, do not block it.

## Simple Implementation Plan If Bots Hit API Routes

1. Inspect `src/app/robots.ts` or `src/app/robots.txt` route if present.
2. Inspect `src/app/sitemap.ts` or sitemap route if present.
3. Make sure API routes are not in sitemap.
4. Add robots disallow rules only for routes that should not be crawled.
5. Do not block product pages if SEO matters.

Safe candidates to discourage from crawling:

```txt
/api/
/checkout
/cart
/account
/admin
/wishlist
/search/visual
```

Do not blindly block:

```txt
/products/
/categories/
/collections/
/store
```

Those may be important for SEO.

## Simple Implementation Plan If Prefetch Is Too Aggressive

1. Confirm with DevTools Network that background requests happen before click.
2. Identify the component creating those links.
3. Disable prefetch only on high-volume product-card links if needed.
4. Keep normal navigation working.
5. Do not globally disable useful caching or static generation.

## Simple Implementation Plan If Expensive Endpoints Need Rate Limits

Start only with expensive endpoints:

- `/api/storefront/search/image`
- `/api/storefront/search`
- endpoints that create carts or call full cart repeatedly

Keep rate limiting simple:

1. Prefer hosting/platform rate limiting if available.
2. If app-level rate limiting is needed, keep it small and isolated.
3. Do not create complex persistence tables unless required.
4. Return clear `429` responses.

## How To Avoid Breaking Existing Functionality

- SEO pages must remain accessible.
- Customers must still search, add to cart, and checkout.
- Admin routes must remain protected.
- Do not cache user-specific responses publicly.
- Do not block payment callbacks.

## What Not To Do

- Do not block normal product page crawling completely if SEO matters.
- Do not cache user-specific layout/cart/account responses publicly.
- Do not add complex bot protection until monitoring shows a real issue.

## Testing If Changed Later

1. Open `/robots.txt`.
2. Confirm API routes are not promoted for crawling.
3. Open `/sitemap.xml`.
4. Confirm only intended public pages are listed.
5. Browse store and product pages normally.
6. Confirm links still work and SEO pages still load.
7. In Network, confirm hovering/scrolling product cards does not trigger unexpected heavy API requests.

## References

- Supabase egress debugging recommends checking most requested API endpoints: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Next.js caching guide: https://nextjs.org/docs/app/guides/caching
