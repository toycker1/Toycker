# Remaining Risk: Production Monitoring And Alerting

## Status

Completed and manually verified on 07 May 2026.

This task is intentionally `Supabase-only`. The implementation is a production monitoring process, not an application feature.

## Classification

`Supabase-only`

No code change, no Supabase migration, and no new table are required for weekly monitoring.

## Migration Decision

Priority 19 does not need a migration file.

Reason:

- Monitoring uses Supabase Dashboard Usage, Logs Explorer, Query Performance, and read-only SQL checks.
- No app data needs to be stored in a new table.
- No existing table needs a column change.
- No RLS policy needs to be created or changed.
- No production write is needed.

In simple words:

> This priority is about watching production usage before it becomes dangerous. It should not change the live database.

## Why This Is High Priority

Even after priorities 1-10, Supabase egress can still increase from real users, bots, admin work, checkout traffic, or future code changes.

Monitoring is the only way to catch this before the Free Plan limit is reached.

Priority 19 is the final guardrail after the code optimizations. It does not reduce egress by itself. It tells the team when egress is rising, where to look, and which already-written risk file should be used next.

## What Was Implemented For Priority 19

The implementation is this runbook plus the weekly log template:

- This file defines the exact monitoring workflow.
- `19-weekly-production-monitoring-log-template.md` gives a repeatable format for weekly reviews.
- The remaining-risk index points to this monitoring process.
- The workflow keeps production checks read-only unless the user explicitly approves a production change.

No code file was changed for Priority 19 because adding a custom monitoring UI would add complexity without reducing Supabase egress.

## Related Code Areas Reviewed

These code areas were reviewed only to understand what monitoring should watch:

- `src/app/admin/page.tsx`
- `src/lib/data/analytics.ts`
- `src/modules/admin/components/notifications/index.tsx`
- storefront product/list/search/cart paths already optimized by priorities 1-18

Current conclusion:

- Admin dashboard still makes normal admin queries, but Priority 16 already reduced the risky admin/export payloads.
- Admin notifications use realtime only on `admin_notifications`, which matches the restricted realtime scope from Priority 8.
- Public traffic and prefetch risk were handled in Priority 18.
- Priority 19 should not change these files unless future monitoring shows one of them is a real top egress source.

## External Tools To Use

Use these tools during weekly review:

- Supabase Dashboard Usage page
- Supabase Logs Explorer
- Supabase Query Performance / Database inspection
- Vercel Analytics or hosting logs
- Cloudflare dashboard for CDN/cache behavior
- Git history for recent deploys

## What To Monitor Weekly

In Supabase Dashboard, check:

- Total Egress
- Cached Egress
- Database Requests
- Auth Requests
- Storage Requests
- Realtime Messages
- Realtime Peak Connections
- Database Size
- Storage Size

Also check these project-specific expectations:

- Storage should usually remain near `0` because media is on Cloudflare R2/CDN.
- Realtime tables should remain only `orders` and `admin_notifications`.
- Product media should keep using `cdn.toycker.in`.
- Public product listing should not return full product detail payload.
- Layout state should remain small.

Recommended alert level:

- Below `3.0GB`: normal
- `3.0GB` to `4.0GB`: watch closely
- Above `4.0GB`: investigate immediately
- Near `5.0GB`: stop non-essential heavy testing and inspect top endpoints

## Weekly Monitoring Workflow

Do this once per week, and also after any large deployment.

1. Open Supabase Dashboard for the production project `toycker`.
2. Open the Usage page for the current billing cycle.
3. Record these values in `19-weekly-production-monitoring-log-template.md`:
   - Total Egress
   - Cached Egress
   - Database Requests
   - Auth Requests
   - Storage Requests
   - Realtime Messages
   - Realtime Peak Connections
   - Database Size
   - Storage Size
4. Compare total egress with the threshold table below.
5. If egress is below `3.0GB`, continue normal development.
6. If egress is `3.0GB` or higher, check recent deploys and high-traffic pages.
7. If egress is `4.0GB` or higher, treat it as urgent and inspect logs before doing more heavy testing.
8. If egress is near `5.0GB`, pause non-essential imports, exports, visual-search testing, repeated cart/checkout refreshes, and admin bulk work.
9. Match the problem area to the correct risk file before changing code.

## Alert Threshold Actions

| Total egress in current billing cycle | Meaning | Action |
| --- | --- | --- |
| `< 3.0GB` | Healthy for Free Plan | Record weekly numbers and continue. |
| `3.0GB - 3.5GB` | Early warning | Review recent deploys, public traffic, and dashboard request category. |
| `3.5GB - 4.0GB` | Watch closely | Stop unnecessary heavy testing and check Logs Explorer. |
| `4.0GB - 4.5GB` | Urgent | Identify top path/query and use the matching risk file. |
| `4.5GB - 5.0GB` | Critical | Avoid admin export/import, repeated visual search, and load-style testing until the source is known. |
| `>= 5.0GB` | Free Plan limit risk | Expect possible Supabase restriction; reduce traffic and investigate immediately. |

## How To Identify The Source Of A Spike

Start with the Supabase Usage category that increased.

If Database Requests or database egress increased:

- Check Supabase Logs Explorer for the most common REST/RPC paths.
- Check Query Performance for frequent queries and high row counts.
- Match the path to:
  - product listing: priorities 1, 2, 3, 6
  - product detail: `13-product-detail-full-payload-risk.md`
  - cart/checkout: `14-cart-checkout-and-stale-cart-risk.md`
  - visual search: `15-visual-search-and-embedding-risk.md`
  - admin/export/import: `16-admin-dashboard-export-risk.md`
  - bots/prefetch/public traffic: `18-bot-prefetch-and-public-traffic-risk.md`

If Storage Requests or Storage egress increased:

- Check whether any URL contains `supabase.co/storage`.
- Check whether media has accidentally moved away from `cdn.toycker.in`.
- Use `17-media-cdn-cache-regression-risk.md`.

If Auth Requests increased:

- Check login/signup/session-heavy flows.
- Re-check Priority 9.

If Realtime Messages or Realtime connections increased:

- Verify publication tables still only include `orders` and `admin_notifications`.
- Re-check Priority 8.

If Vercel Analytics shows many public page hits:

- Check whether the traffic is real users, bots, or repeated testing.
- Re-check Priority 18 before adding new code.

## Production Checks Already Verified

Read-only production verification on 05 May 2026:

- Production project: `toycker`
- Production ref: `xhfasilbxjjxaqgxkann`
- Price-filter RPC migration is applied.
- Realtime publication migration is applied.
- Realtime publication contains only:
  - `public.admin_notifications`
  - `public.orders`
- Supabase Storage bucket count is `0`.
- Product Supabase Storage URLs count is `0`.
- Product CDN URL count is `295`.

## Production Usage Review On 07 May 2026

The Supabase production Usage dashboard was reviewed for project `toycker` in the billing cycle `25 Apr 2026 - 25 May 2026`.

Observed values:

- Total egress: `3.886 GB`
- Cached egress: `0.001 GB`
- Database size: `0.039 GB`
- Storage size: `0 GB`
- Monthly active users: `25 MAU`
- Monthly active third-party users: `0 MAU`
- Monthly active SSO users: `0 MAU`
- Realtime messages: `63`
- Realtime concurrent peak connections: `12`
- Edge Function invocations: `0`
- Storage image transformations: `0`

Egress detail from 07 May 2026:

- PostgREST egress: `26.967 MB`, about `96.6%` of that day's visible egress breakdown.
- Auth egress: `790.228 KB`, about `2.8%`.
- Realtime egress: `200.153 KB`, about `0.7%`.
- Storage egress: shown as `NaN/undefined` in the dashboard tooltip, while Storage size remains `0 GB`.
- Cached egress on 07 May 2026: `30.912 KB`.
- Database size detail: `37.12 MB`.

Status decision:

`3.886 GB` is in the `3.5GB - 4.0GB` watch-closely range.

This is not yet over the Free Plan egress quota, but it is close enough that the team should avoid unnecessary heavy testing, repeated admin exports/imports, repeated visual-search testing, and load-style page refreshing until the billing cycle resets or the next review confirms the daily egress trend is low.

Current interpretation:

- Storage is still not the problem because Storage size is `0 GB`.
- Edge Functions are not the problem because invocations are `0`.
- Realtime is not the main problem because message count and realtime egress are low.
- The main current egress source is still database/API traffic, shown by the PostgREST egress share.
- This matches the purpose of priorities 1-18, which reduced database payloads and repeated public requests.

Current action:

- Continue weekly monitoring.
- If total egress crosses `4.0 GB`, inspect Supabase Logs Explorer and Query Performance immediately.
- If PostgREST remains the dominant source, first re-check product listing, product detail, cart/checkout, visual search, admin/export, and bot/prefetch risk files before making any new code change.
- Do not run production writes, cleanup, or migrations from this monitoring task.

## Required Git History Check

Before changing code because of a monitoring spike, always inspect recent Git history.

This is required because priorities 1-18 already changed product, cart, search, admin, media, and bot/prefetch behavior. Git history tells the AI or developer what has already been done and prevents duplicate or conflicting changes.

Recommended commands:

```powershell
git log --oneline --decorate --max-count=50
git log --oneline -- supabase-free-plan-priorities
git show --stat <recent-or-relevant-commit>
```

If the spike started after a recent deployment, inspect only the files changed by that deployment first. Do not revert automatically.

## Git History To Check First

When monitoring shows a new spike, inspect Git history before changing code. This helps identify whether the spike relates to recent changes or an already-completed priority.

Recommended commands:

```powershell
git log --oneline --decorate --max-count=50
git log --oneline -- supabase-free-plan-priorities
git show --stat <recent-or-relevant-commit>
```

If the spike started after a known commit, inspect only the changed files first. Do not revert the commit automatically; understand the change and confirm the high-egress path before proposing a fix.

## What To Do If Egress Rises

1. Open Supabase Usage.
2. Check whether the rise is Database, Auth, Storage, Realtime, Edge Functions, or cached egress.
3. Open Supabase Logs Explorer.
4. Check most requested API paths.
5. Check Query Performance / Advisors for frequent queries and rows returned.
6. Match the high path/query to the risk files:
   - product detail: `13-product-detail-full-payload-risk.md`
   - cart/checkout: `14-cart-checkout-and-stale-cart-risk.md`
   - visual search: `15-visual-search-and-embedding-risk.md`
   - admin/export: `16-admin-dashboard-export-risk.md`
   - media/CDN: `17-media-cdn-cache-regression-risk.md`
   - bots/public traffic: `18-bot-prefetch-and-public-traffic-risk.md`

## Read-Only Production Query Rules

These SQL checks are safe because they only use `select`.

Do not run:

- `insert`
- `update`
- `delete`
- `alter`
- `drop`
- `truncate`
- `create policy`
- `create table`
- migration commands

unless the user explicitly asks for a production change and a backup is taken first.

## Simple Read-Only SQL Checks

Use these only as read-only checks. Do not run update/delete/alter statements from this monitoring file.

Check Realtime publication:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by schemaname, tablename;
```

Expected:

```txt
public.admin_notifications
public.orders
```

Check Supabase Storage bucket count:

```sql
select count(*) as bucket_count
from storage.buckets;
```

Expected for current Toycker setup:

```txt
0
```

Check product media host:

```sql
select
  count(*) filter (
    where image_url like '%supabase.co/storage/%'
       or thumbnail like '%supabase.co/storage/%'
  ) as product_supabase_storage_urls,
  count(*) filter (
    where image_url like 'https://cdn.toycker.in/%'
       or thumbnail like 'https://cdn.toycker.in/%'
  ) as product_cdn_urls,
  count(*) as product_count
from public.products;
```

Expected:

```txt
product_supabase_storage_urls = 0
product_cdn_urls should be close to product_count
```

Check approximate growth of important tables:

```sql
select relname as table_name, n_live_tup as estimated_rows
from pg_stat_user_tables
where schemaname = 'public'
  and relname in (
    'products',
    'product_variants',
    'orders',
    'carts',
    'cart_items',
    'reviews',
    'review_media',
    'search_analytics'
  )
order by relname;
```

Large changes are not automatically bad, but they tell you where to investigate.

Check whether abandoned carts are growing:

```sql
select
  count(*) as cart_count,
  count(*) filter (where updated_at < now() - interval '30 days') as older_than_30_days
from public.carts;
```

If old carts are high, do not delete them immediately. Use `14-cart-checkout-and-stale-cart-risk.md`, take a backup, and get approval first.

Check whether product rows still avoid Supabase Storage URLs inside image arrays:

```sql
select count(*) as products_with_supabase_storage_in_images
from public.products
where images::text like '%supabase.co/storage/%';
```

Expected:

```txt
0
```

Check search analytics growth:

```sql
select count(*) as search_analytics_rows
from public.search_analytics;
```

Large growth is not automatically wrong, but it can show that search or visual search is being used heavily.

## How An AI Agent Should Respond To Monitoring Data

If an AI agent is given a dashboard screenshot or query result:

1. Do not immediately change code.
2. Identify which Supabase category increased.
3. Match it to the correct risk file.
4. Ask for or collect only the missing evidence needed.
5. Propose the smallest safe change.
6. Clearly state whether the change is code-only, Supabase-only, or both.
7. Include manual testing steps.
8. Do not run production writes without explicit approval.

## Manual Acceptance Checks

Priority 19 is complete when the user verifies:

1. Supabase Usage page can be opened for production.
2. The weekly template can be filled with current billing-cycle numbers.
3. The threshold action is clear from the recorded total egress.
4. Read-only SQL checks can be run without changing data.
5. The team knows which risk file to use if a spike appears.

No storefront, cart, checkout, admin, search, or media workflow should change because this priority does not modify application behavior.

## What Not To Do

- Do not wait until egress reaches `5GB`.
- Do not assume Storage is the issue unless Storage requests/egress increase.
- Do not run production cleanup or migrations without backups.
- Do not optimize random code without identifying the high-traffic path first.
- Do not create a custom dashboard unless the Supabase dashboard is no longer enough.
- Do not add background jobs, cron, Redis, or a new analytics table for this basic prototype.

## Weekly Review Template

```txt
Date:
Billing cycle:
Total egress:
Cached egress:
Database requests:
Auth requests:
Storage requests:
Realtime messages:
Top suspicious endpoint:
Action needed:
Next review date:
```

Use the separate template file for actual reviews:

```txt
supabase-free-plan-priorities/19-weekly-production-monitoring-log-template.md
```

## Simple Explanation For Senior Review

Priority 19 is not a code optimization. It is the production monitoring process that keeps the team from being surprised by Supabase Free Plan limits.

The project should continue using Cloudflare for media and Supabase for database/auth/realtime. Every week, the team should record Supabase Usage numbers, compare egress against the threshold, and investigate early if egress reaches `3.0GB` or more in the billing cycle.

If egress rises, the first step is not to change code randomly. The first step is to identify whether the rise came from database, auth, storage, realtime, bots, admin work, cart/checkout, product detail, or visual search. Then use the matching risk file.

This approach is safe for production because it does not create tables, change data, change RLS policies, or alter existing workflows.

## References

- Supabase egress usage and debugging: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Supabase egress troubleshooting: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase database inspection: https://supabase.com/docs/guides/database/inspect
- Supabase billing on Supabase: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase billing FAQ: https://supabase.com/docs/guides/platform/billing-faq
- Supabase Realtime limits: https://supabase.com/docs/guides/realtime/rate-limits
- Vercel Observability: https://vercel.com/docs/observability
- Vercel Web Analytics: https://vercel.com/docs/analytics
- Cloudflare cache concepts: https://developers.cloudflare.com/cache/concepts/cache-control/
