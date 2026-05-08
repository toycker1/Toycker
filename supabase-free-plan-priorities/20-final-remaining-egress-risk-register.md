# Final Remaining Egress Risk Register

## Purpose

This file is the final catch-all register for Supabase egress risks after priorities 1-10 and remaining risks 13-19.

The purpose is to avoid creating new Markdown files for every small future concern. If Supabase egress rises again, start here and then open the matching specific file.

Important:

> The project can reduce unnecessary Supabase egress, but it cannot have zero egress. Every real database response, auth response, realtime message, and API response still counts as usage.

## Status

`Documented for future monitoring and safe implementation`

This file does not mean new code must be written immediately.

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
| Account order/customer private data | Documented here as remaining private-route risk | `21-private-account-order-and-customer-data-risk.md` | `code-only if needed` |
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

