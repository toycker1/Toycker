# Supabase Free Plan Priority Index

## Purpose

This folder breaks the Supabase Free Plan usage work into separate priorities. Each priority explains whether the required work is:

- `code-only`
- `Supabase-only`
- `both (codebase + Supabase)`

The main target is to reduce Supabase egress and avoid Free Plan quota restrictions without upgrading the plan.

## Recommended Execution Order

Do the `code-only` work first because it can reduce usage without changing Supabase configuration or database schema.

| Order | Priority | Classification | Status | Why It Comes Here |
| --- | --- | --- | --- | --- |
| 1 | Lightweight product listing queries | code-only | Completed and manually verified on 04 May 2026 | Biggest likely egress reduction because listing pages previously fetched detail-level product data. |
| 2 | Database-level pagination | code-only | Completed and manually verified on 04 May 2026 | Prevents large product responses during normal browsing. |
| 3 | Layout state payload reduction | code-only | Completed and manually verified on 05 May 2026 | Avoids full cart/customer reads on every public page load. |
| 4 | Cart summary vs full cart | code-only | Completed and manually verified on 05 May 2026 | Keeps global UI lightweight while preserving full cart behavior where needed. |
| 5 | Public storefront caching | code-only | Pending | Reduces repeated Supabase reads for public data. |
| 6 | Search request and payload optimization | code-only | Pending | Reduces search request count and response size. |
| 7 | Auth request reduction | code-only | Pending | Reduces repeated Auth/session traffic. |
| 8 | Price filtering in database | both | Pending | Best fix needs SQL/view/RPC support plus app changes. |
| 9 | Realtime scope and table config | both | Pending | Requires code subscription limits and Supabase table configuration review. |
| 10 | Media and storage egress control | both | Pending | Only important if media is served from Supabase Storage. |
| 11 | Monitoring and usage review | Supabase-only | Pending | Ongoing dashboard and log review, no code change required. |

## Current Evidence From Toycker

The current screenshots show high database activity relative to Storage and Realtime:

- Database requests: high
- Storage requests: low
- Realtime requests: low
- Egress: already over half of the Free Plan uncached egress allowance in the shown billing cycle

Local code inspection supports the same conclusion:

- Product listing functions previously used a large `PRODUCT_SELECT` in `src/lib/data/products.ts`.
- Priority 1 is now implemented: listing functions use a lightweight card select, while detail and quick-view flows can still request full product detail data.
- Priority 2 is now implemented: public product listing requests normalize page and limit values, cap listing limits, and apply bounded Supabase ranges.
- Price filtering is now bounded in the code-only pass, but the complete exact variant-price filtering fix still belongs to Priority 3.
- Priority 4 is now implemented: `/api/storefront/layout-state` returns lightweight customer and cart summary fields only.
- Priority 5 is now implemented: count-only UI uses lightweight cart summary fallback, while full cart retrieval remains limited to cart drawer, cart page, checkout, and cart actions.
- Full cart retrieval still exists for cart, checkout, cart sidebar detail loading, and cart actions.
- The manually verified layout-state response includes only `customer.id`, `customer.first_name`, `customer.is_club_member`, and cart summary fields such as `id`, `user_id`, `region_id`, `currency_code`, `updated_at`, and `item_count`.
- The manually verified shipping-options response still returns active shipping options after switching the endpoint to lightweight cart summary lookup.
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
