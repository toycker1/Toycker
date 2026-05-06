# Remaining Risk: Production Monitoring And Alerting

## Classification

`Supabase-only`

No code change is required for weekly monitoring.

## Why This Is High Priority

Even after priorities 1-10, Supabase egress can still increase from real users, bots, admin work, checkout traffic, or future code changes.

Monitoring is the only way to catch this before the Free Plan limit is reached.

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

## What Not To Do

- Do not wait until egress reaches `5GB`.
- Do not assume Storage is the issue unless Storage requests/egress increase.
- Do not run production cleanup or migrations without backups.
- Do not optimize random code without identifying the high-traffic path first.

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

## References

- Supabase egress usage and debugging: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Supabase egress troubleshooting: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase database inspection: https://supabase.com/docs/guides/database/inspect
