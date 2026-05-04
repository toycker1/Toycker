# Supabase Free Plan Priority Index

## Purpose

This folder breaks the Supabase Free Plan usage work into separate priorities. Each priority explains whether the required work is:

- `code-only`
- `Supabase-only`
- `both (codebase + Supabase)`

The main target is to reduce Supabase egress and avoid Free Plan quota restrictions without upgrading the plan.

## Recommended Execution Order

Do the `code-only` work first because it can reduce usage without changing Supabase configuration or database schema.

| Order | Priority | Classification | Why It Comes Here |
| --- | --- | --- | --- |
| 1 | Lightweight product listing queries | code-only | Biggest likely egress reduction because listing pages currently fetch detail-level product data. |
| 2 | Database-level pagination | code-only | Prevents large product responses during normal browsing. |
| 3 | Layout state payload reduction | code-only | Avoids full cart/customer reads on every public page load. |
| 4 | Cart summary vs full cart | code-only | Keeps global UI lightweight while preserving full cart behavior where needed. |
| 5 | Public storefront caching | code-only | Reduces repeated Supabase reads for public data. |
| 6 | Search request and payload optimization | code-only | Reduces search request count and response size. |
| 7 | Auth request reduction | code-only | Reduces repeated Auth/session traffic. |
| 8 | Price filtering in database | both | Best fix needs SQL/view/RPC support plus app changes. |
| 9 | Realtime scope and table config | both | Requires code subscription limits and Supabase table configuration review. |
| 10 | Media and storage egress control | both | Only important if media is served from Supabase Storage. |
| 11 | Monitoring and usage review | Supabase-only | Ongoing dashboard and log review, no code change required. |

## Current Evidence From Toycker

The current screenshots show high database activity relative to Storage and Realtime:

- Database requests: high
- Storage requests: low
- Realtime requests: low
- Egress: already over half of the Free Plan uncached egress allowance in the shown billing cycle

Local code inspection supports the same conclusion:

- Product listing functions use a large `PRODUCT_SELECT` in `src/lib/data/products.ts`.
- Price filtering can fetch all matching products before filtering in application code.
- Layout state calls `/api/storefront/layout-state` with `cache: "no-store"`.
- Cart retrieval fetches full cart items with `product:products(*)` and `variant:product_variants(*)`.
- Realtime exists mainly in admin/order components and is currently not the primary issue.

## Classification Summary

### Code-Only First

- `01-lightweight-product-listing-queries.md`
- `02-database-level-pagination.md`
- `04-layout-state-payload-reduction.md`
- `05-cart-summary-vs-full-cart.md`
- `06-public-storefront-caching.md`
- `07-search-request-and-payload-optimization.md`
- `09-auth-request-reduction.md`

### Both Codebase And Supabase

- `03-price-filtering-in-database.md`
- `08-realtime-scope-and-table-config.md`
- `10-media-and-storage-egress-control.md`

### Supabase-Only

- `11-monitoring-and-usage-review.md`

## References

- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase billing FAQ: https://supabase.com/docs/guides/platform/billing-faq
- Supabase Storage bandwidth: https://supabase.com/docs/guides/storage/serving/bandwidth
- Supabase Realtime rate limits: https://supabase.com/docs/guides/realtime/rate-limits
- Supabase database advisors: https://supabase.com/docs/guides/database/database-advisors
