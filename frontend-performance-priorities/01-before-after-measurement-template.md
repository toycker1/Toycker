# Priority 1 Before/After Measurement Template

Use this file to record Lighthouse and Network values before changing performance-sensitive code and after each frontend performance priority.

Status: Local homepage baseline recorded on 2026-05-11
Supabase migration required: No

## Test Context

- Date: 2026-05-11
- Tester: Manual local verification
- Environment: Local production build
- Browser: Chrome
- Mode: Incognito
- Logged in state: logged out for homepage, logged in for admin checks
- Cache setting: browser cache active during Network review
- Network throttling: No throttling
- Notes: `/api/cache/telemetry` returned `204` on verified public, checkout, and admin pages.

## Page Measurements

| Page | Run | Performance | FCP | LCP | TBT | CLS | Speed Index | Transfer | Requests | Largest image/video | Largest JS chunk | Third-party scripts | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | Before 1 | 37 | 1.4s | 42.5s | 4,780ms | 0 | 7.6s | 2.7 MB | 89 | `7974c50c-8fbb-423c-aeaf-e5b9b76bb5df.jpg` / media mostly disk cache | `76834_react-icons_fa6_index_mjs_60ed0b55._js` 519 kB | Vercel/Meta requests visible locally | Local Lighthouse mobile |
| `/` | Before 2 | 39 | 1.4s | 41.9s | 4,850ms | 0 | 6.3s |  |  |  |  |  | Local Lighthouse mobile |
| `/` | Before 3 | 38 | 1.4s | 41.1s | 4,770ms | 0 | 6.7s |  |  |  |  |  | Local Lighthouse mobile |
| `/store` | Before 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| `/categories/[handle]` | Before 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| `/collections/[handle]` | Before 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| `/products/[handle]` | Before 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| `/search/visual` | Before 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| `/cart` | Before 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| `/checkout?step=address` | Before 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| `/wishlist` | Before 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| `/account` | Before 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| `/admin` | Before 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| `/admin/products` | Before 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| `/admin/orders` | Before 1 |  |  |  |  |  |  |  |  |  |  |  |  |

## Manual Verification

- `/api/cache/telemetry` returns `204` in DevTools Network.
- Vercel Speed Insights remains enabled.
- No Supabase migration file was created.
- No cart, checkout, account, product, or admin behavior changed.
