# Remaining Egress Risk Index

## Purpose

Priorities 1-10 reduced the main avoidable Supabase egress risks. This file lists the remaining risks that can still increase egress during real usage.

Important point:

> The goal is not zero egress. The goal is controlled egress, where Supabase only sends data that the current workflow actually needs.

## How An AI Agent Should Use These Files

These files are not automatic implementation tickets. They are risk playbooks.

Before making any change, an AI agent should:

1. Read this index.
2. Read the specific risk file that matches the observed production issue.
3. Check Git history to understand what was already completed in priorities 1-10.
4. Confirm the issue with code inspection, Supabase dashboard data, logs, or read-only SQL.
5. Implement only the smallest change that fixes the measured problem.
6. Avoid touching unrelated storefront, cart, checkout, admin, auth, or Supabase files.
7. Run quality checks after implementation:
   - `pnpm.cmd exec tsc --noEmit`
   - `pnpm.cmd lint`
   - `pnpm.cmd build`
   - `git diff --check`

Known quality-check caveats from the current repo:

- `pnpm.cmd build` passes.
- `pnpm.cmd exec tsc --noEmit` may fail because of an existing unrelated test type issue under `tests/`.
- `pnpm.cmd lint` may fail because the current `next lint` command resolves `lint` as a project directory.

If those two known issues are still present, do not hide them. Report them clearly.

## Git History Checks

Before implementing any remaining-risk change, inspect the completed priority work in Git. This helps avoid duplicating work or undoing a previous optimization.

Recommended commands:

```powershell
git log --oneline --decorate --max-count=30
git log --oneline -- supabase-free-plan-priorities
git log --oneline -- src/lib/data/products.ts src/lib/data/cart.ts src/lib/data/layout-state.ts src/lib/data/search.ts
git log --oneline -- supabase/migrations/20260505133000_storefront_price_filtered_products.sql supabase/migrations/20260505170000_limit_realtime_publication_tables.sql
```

For a specific commit, inspect details with:

```powershell
git show --stat <commit>
git show -- <file>
```

Use Git history only for understanding. Do not revert completed priority work unless the user explicitly asks for it.

## Production Verification On 05 May 2026

Read-only production checks were run against the `toycker` Supabase project. No production data was added, updated, deleted, or migrated.

Evidence:

- Migration `20260505133000_storefront_price_filtered_products` exists in production.
- Migration `20260505170000_limit_realtime_publication_tables` exists in production.
- Realtime publication contains only:
  - `public.admin_notifications`
  - `public.orders`
- Supabase Storage bucket count is `0`.
- Product media using Supabase Storage URLs: `0`.
- Product media using `https://cdn.toycker.in`: `295`.
- Approximate production table sizes:
  - `products`: `295`
  - `product_variants`: `41`
  - `carts`: `508`
  - `cart_items`: `443`
  - `orders`: `51`
  - `reviews`: `2`
  - `review_media`: `0`
  - `search_analytics`: `0`

## Remaining Risk Files

| File | Risk Area | Classification | Priority | Status |
| --- | --- | --- | --- | --- |
| `13-product-detail-full-payload-risk.md` | Product detail and quick-view payload size | `code-only` | Medium | Completed and manually verified on 06 May 2026 |
| `14-cart-checkout-and-stale-cart-risk.md` | Cart/checkout are intentionally dynamic and old carts can accumulate | `both (codebase + Supabase)` | Medium | Completed for code-side cart payload reduction and manually verified on 06 May 2026; Supabase cleanup remains monitoring-only |
| `15-visual-search-and-embedding-risk.md` | Visual search can trigger image processing and vector RPC work | `code-only now; both if database tuning is later needed` | Medium | Completed and manually verified on 06 May 2026; request-volume monitoring remains |
| `16-admin-dashboard-export-risk.md` | Admin pages, exports, and backfill jobs can return large data | `code-only` | Low to Medium | Completed and verified on 07 May 2026 |
| `17-media-cdn-cache-regression-risk.md` | Future media changes could bypass Cloudflare and hit Supabase Storage | `code-only for repo; external Cloudflare checks also required` | Medium | Pending |
| `18-bot-prefetch-and-public-traffic-risk.md` | Bots, crawlers, and aggressive prefetch can multiply public reads | `code-only` | Medium | Pending |
| `19-production-monitoring-and-alerting.md` | Egress must be watched weekly before it reaches the Free Plan limit | `Supabase-only` | High | Pending |

## Recommended Phase Order

1. Keep weekly monitoring active in Supabase.
2. Watch cart/checkout endpoint volume.
3. Add small guardrails only if real usage proves a remaining risk is growing.
4. Avoid extra migrations unless production metrics show a clear need.

## Decision Rules

Use these rules before implementation:

- If the issue is high traffic to public list pages, first re-check priorities 1, 2, 3, 6, and 7 before creating new work.
- If the issue is product detail pages, use `13-product-detail-full-payload-risk.md`.
- If the issue is cart, checkout, or abandoned carts, use `14-cart-checkout-and-stale-cart-risk.md`.
- If the issue is image/visual search, use `15-visual-search-and-embedding-risk.md`.
- If the issue is admin dashboard, export, import, or backfill, use `16-admin-dashboard-export-risk.md`.
- If the issue is media, CDN, images, video, audio, or Storage, use `17-media-cdn-cache-regression-risk.md`.
- If the issue is unexplained public traffic or repeated API hits, use `18-bot-prefetch-and-public-traffic-risk.md`.
- If no clear issue is found, use `19-production-monitoring-and-alerting.md` and keep watching.

## What Should Not Be Implemented Without Evidence

Do not implement these just because they sound useful:

- Redis or external caching infrastructure.
- New background job systems.
- New tables for analytics unless dashboard/log data proves a need.
- Full rewrite of product/cart/admin data layers.
- Moving media to Supabase Storage.
- Removing valid checkout/cart/detail data that users need.
- Broad rate limiting that can block real customers.

## References

- Supabase egress: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Supabase egress troubleshooting: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase Realtime limits: https://supabase.com/docs/guides/realtime/rate-limits
- Supabase Storage optimizations: https://supabase.com/docs/guides/storage/production/scaling
- Next.js caching: https://nextjs.org/docs/app/guides/caching
- Cloudflare cache control: https://developers.cloudflare.com/cache/concepts/cache-control/
