# Final Remaining Egress Risk Register

## Purpose

This file is the final catch-all register for Supabase egress risks after priorities 1-10 and remaining risks 13-19.

The purpose is to avoid creating new Markdown files for every small future concern. If Supabase egress rises again, start here and then open the matching specific file.

Important:

> The project can reduce unnecessary Supabase egress, but it cannot have zero egress. Every real database response, auth response, realtime message, and API response still counts as usage.

## Status

`Completed as final remaining-risk monitoring gate on 08 May 2026`

This file does not mean new code must be written immediately. It is the final decision point before any future Supabase egress work is started.

The implementation decision for this final register is:

- No application code change is required right now.
- No Supabase migration is required.
- No new table is required.
- No existing table change is required.
- No new RLS policy is required.
- No existing RLS policy update is required.
- No production data change is required.

Reason:

The known high-risk areas have already been handled or documented in priorities 1-19 and remaining-risk files 21-23. Any further change should be based on measured evidence from Supabase, Vercel, or Cloudflare, not on guesswork.

## Classification

Mixed:

- `code-only` for query payload changes.
- `Supabase-only` for dashboard/log monitoring and read-only checks.
- `both (code + Supabase)` if cleanup, indexes, RPC changes, or database maintenance are later required.

## Required Git History Check

Before any AI agent or developer changes code for a remaining egress risk, check Git history first.

Recommended commands:

```powershell
git log --oneline --decorate --max-count=50
git log --oneline -- supabase-free-plan-priorities
git log --oneline -- src/lib/data src/app/api src/modules
git show --stat <recent-or-relevant-commit>
```

Reason:

Priorities 1-19 already changed product listing, pagination, price filtering, layout state, cart, checkout, search, visual search, admin/export/import, media, bots, realtime, and monitoring. Checking Git history prevents duplicate work and prevents accidentally undoing an earlier optimization.

## Current Verified State

Based on the completed priority work:

- Public product listing no longer returns full product detail payload.
- Storefront pagination is bounded.
- Price filtering is handled in the database/RPC path.
- Layout state returns customer/cart summary only.
- Search returns lightweight summary data.
- Visual search does not return embeddings.
- Cart no longer returns product descriptions, SEO data, video URLs, search vectors, or embeddings.
- Admin product list and top products use smaller display fields.
- Media is expected to stay on Cloudflare R2/CDN, not Supabase Storage.
- Realtime publication is limited to intentional tables.
- Bots and prefetch traffic are reduced.
- Weekly monitoring is documented.

## Simple Before And After

Before this final register:

- Product listing, cart, checkout, search, visual search, admin, media, bots, realtime, and monitoring had separate optimization work.
- Some remaining concerns were still possible, but they needed a single place to decide what to do next.

After this final register:

- The project has a final map for all remaining Supabase egress risks.
- Future work should start from monitoring evidence first.
- If there is no measured problem, keep watching weekly and do not change code.
- If there is a measured problem, use the matching risk file and make the smallest safe change.

In simple terms:

> This file prevents random optimization. It tells the next developer or AI agent what to check, which risk file to use, and when it is actually safe to implement more.

## Final Risk Map

| Risk area | Current status | File to use first | Classification |
| --- | --- | --- | --- |
| Product listing returns too much data | Implemented | `01`, `02`, `03`, `06` | `code-only` |
| Product detail page is naturally heavier | Implemented for quick view; detail remains intentionally full | `13-product-detail-full-payload-risk.md` | `code-only` |
| Cart and checkout dynamic payload | Implemented for main cart payload; monitor volume | `14-cart-checkout-and-stale-cart-risk.md` | `both` |
| Visual search request volume | Implemented for payload; monitor repeated use | `15-visual-search-and-embedding-risk.md` | `code-only now` |
| Admin list/export/import/backfill | Implemented for main list/export/import paths | `16-admin-dashboard-export-risk.md` | `code-only` |
| Media accidentally moves to Supabase Storage | Guardrails implemented | `17-media-cdn-cache-regression-risk.md` | `code-only + Cloudflare checks` |
| Bots, crawlers, hover prefetch, public traffic | Implemented | `18-bot-prefetch-and-public-traffic-risk.md` | `code-only` |
| Production usage monitoring | Implemented | `19-production-monitoring-and-alerting.md` | `Supabase-only` |
| Account order/customer private data | Implemented for account order list summary; private detail/customer/review pages remain monitoring-based | `21-private-account-order-and-customer-data-risk.md` | `both (codebase + Supabase)` |
| Home cached media sections | Documented here as cached public-media risk | `22-home-page-cached-media-section-risk.md` | `code-only + Cloudflare checks` |
| Low-volume wildcard/admin detail queries | Documented here as operational risk | `23-low-volume-wildcard-and-admin-detail-risk.md` | `code-only if measured` |

## How To Decide Whether To Implement More

Do not optimize randomly.

Only make more changes if one of these is true:

- Supabase Usage shows total egress crossing a monitoring threshold.
- Supabase Logs Explorer shows a specific endpoint is responsible.
- Query Performance shows a specific query returns too many rows or too many large columns.
- Vercel/hosting logs show repeated public page hits from bots or aggressive refreshes.
- Cloudflare shows media cache misses or media bypassing the CDN.

If there is no measured issue, keep monitoring.

## Future Implementation Trigger

Future implementation should happen only when at least one clear trigger is present.

Use this rule:

> No measured source, no new optimization.

Valid triggers:

- Supabase total egress moves into the danger range for the current billing cycle.
- Supabase PostgREST egress grows quickly over several days.
- Supabase Logs Explorer points to a specific API route or database endpoint.
- Query Performance shows a specific query returning too many rows or heavy columns.
- Vercel logs show repeated public page requests from bots, crawlers, refreshes, or prefetches.
- Cloudflare analytics shows media cache misses, low cache hit ratio, or large uncached assets.
- Manual browser testing shows an endpoint returning fields that the page does not use.

Invalid triggers:

- A field looks suspicious but no page calls it often.
- A query uses `select("*")` in a low-volume admin-only or callback-only flow.
- A one-time manual test creates a temporary spike.
- An optimization sounds useful but does not have evidence.

## Migration Decision

This final register does not require a Supabase migration.

Nothing will be changed in Supabase by this task:

- No table will be created.
- No table column will be added, removed, or changed.
- No index will be created.
- No RPC/function will be created or replaced.
- No RLS policy will be created or updated.
- No realtime publication will be changed.
- No data cleanup will be run.

If a future measured problem requires a migration, that migration must be planned under the specific matching risk file, not under this final register.

## Manual Verification Checklist

Use this checklist after any future egress-related change:

1. Open the changed page or flow in the browser.
2. Open DevTools Network tab.
3. Filter by `Fetch/XHR`.
4. Check the response payload for the relevant endpoint.
5. Confirm the endpoint does not return unused heavy fields.
6. Confirm the page still works for normal users.
7. Check Supabase Usage and Logs after enough time has passed for metrics to refresh.
8. Record the result in the weekly monitoring log.

## Main Remaining Reality

After all completed work, the biggest remaining risk is usually request volume, not one single huge JSON response.

Examples:

- Many users opening product detail pages.
- Bots crawling product/store pages.
- Repeated cart and checkout refreshes.
- Repeated visual search tests.
- Admin export/import/backfill run too often.
- Home page media cache misses.

The app can reduce payload size and avoid waste, but high traffic will still create Supabase usage.

## What Not To Do

- Do not move images, videos, or audio to Supabase Storage.
- Do not remove data required for checkout safety.
- Do not remove real product detail fields from product detail pages without checking UI needs.
- Do not add Redis, cron jobs, analytics tables, or background workers without evidence.
- Do not run production cleanup, migrations, or writes without backup and explicit approval.
- Do not optimize admin-only low-volume paths before public high-volume paths.

## Quality Checks For Future Changes

Run these after any implementation:

```powershell
pnpm.cmd exec tsc --noEmit
pnpm.cmd lint
pnpm.cmd build
git diff --check
```

Known current caveats:

- `pnpm.cmd build` passes.
- Typecheck may still show an unrelated test issue under `tests/`.
- Lint may still show the existing `next lint` script issue.

Report these clearly instead of hiding them.

