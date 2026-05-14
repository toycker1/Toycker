# Priority 19 Weekly Production Monitoring Log Template

## Purpose

Use this template once per week for the production Supabase project `toycker`.

This is a read-only monitoring log. It should not require code changes, migrations, data updates, or production writes.

## Review Metadata

```txt
Review date:
Reviewer:
Billing cycle:
Production project:
Production ref:
Latest deployed commit:
Recent deployment date:
Next review date:
```

## Supabase Usage Numbers

Record the current billing-cycle values from Supabase Dashboard.

```txt
Total egress:
Cached egress:
Database requests:
Auth requests:
Storage requests:
Realtime messages:
Realtime peak connections:
Database size:
Storage size:
Edge Function invocations:
```

## Threshold Decision

Choose one:

```txt
Status:
- Normal: below 3.0GB egress
- Watch: 3.0GB to 4.0GB egress
- Urgent: above 4.0GB egress
- Critical: near 5.0GB egress

Decision:
Action owner:
Due date:
```

## Expected Toycker Baseline Checks

```txt
Storage bucket count is still 0:
Product Supabase Storage URLs are still 0:
Product CDN URLs still use https://cdn.toycker.in:
Realtime publication tables are still only orders and admin_notifications:
Public listing payload still looks lightweight:
Layout state response still looks small:
Visual search response still excludes embeddings:
Admin export/import was not run heavily this week:
```

## Read-Only SQL Results

Only paste results from `select` queries. Do not run production write queries from this template.

### Realtime Publication

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by schemaname, tablename;
```

```txt
Result:
```

Expected:

```txt
public.admin_notifications
public.orders
```

### Storage Buckets

```sql
select count(*) as bucket_count
from storage.buckets;
```

```txt
Result:
```

Expected:

```txt
0
```

### Product Media Host

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

```txt
Result:
```

Expected:

```txt
product_supabase_storage_urls = 0
product_cdn_urls should be close to product_count
```

### Important Table Sizes

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

```txt
Result:
```

## Spike Investigation

Fill this only if usage is rising faster than expected.

```txt
Which usage category increased:
Top suspicious endpoint or query:
Most likely risk file:
Recent related commit:
Recent related deployment:
Is this real user traffic, admin work, bot traffic, or testing:
Immediate action:
```

Risk file map:

```txt
Product detail: 13-product-detail-full-payload-risk.md
Cart/checkout: 14-cart-checkout-and-stale-cart-risk.md
Visual search: 15-visual-search-and-embedding-risk.md
Admin/export/import: 16-admin-dashboard-export-risk.md
Media/CDN/Storage: 17-media-cdn-cache-regression-risk.md
Bots/prefetch/public traffic: 18-bot-prefetch-and-public-traffic-risk.md
Monitoring process: 19-production-monitoring-and-alerting.md
```

## Final Review Result

```txt
Is Supabase Free Plan usage safe this week:
Is any action required:
Action summary:
Follow-up owner:
Follow-up date:
```
