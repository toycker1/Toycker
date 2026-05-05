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
| 5 | Public storefront caching | code-only | Completed and manually verified on 05 May 2026 | Reduces repeated Supabase reads for public data. |
| 6 | Search request and payload optimization | code-only | Completed and manually verified on 05 May 2026 | Reduces search request count and response size. |
| 7 | Auth request reduction | code-only | Completed and manually verified on 05 May 2026 | Reduces repeated Auth/session traffic. |
| 8 | Price filtering in database | both | Completed and manually verified on 05 May 2026 | Moves variant-aware price filtering, sorting, and pagination into Supabase. |
| 9 | Realtime scope and table config | both | Completed and manually verified on 05 May 2026 | Realtime is now limited to intentional admin/order tables and narrower subscription events. |
| 10 | Media and storage egress control | code-only | Completed and manually verified on 05 May 2026 | Media is served from Cloudflare R2/CDN, so the fix keeps uploads bounded and cacheable without Supabase Storage changes. |
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
- Priority 3 is now implemented: price-filtered storefront listings use the `list_storefront_products_by_price` Supabase RPC from migration `20260505133000_storefront_price_filtered_products.sql`, with variant-aware display price filtering, SQL pagination, SQL sorting, and a supporting `product_variants(product_id, price)` index.
- Priority 4 is now implemented: `/api/storefront/layout-state` returns lightweight customer and cart summary fields only.
- Priority 5 is now implemented: count-only UI uses lightweight cart summary fallback, while full cart retrieval remains limited to cart drawer, cart page, checkout, and cart actions.
- Priority 6 is now implemented: public homepage/category/settings reads use lighter cached selects, storefront home reviews are cached, and admin public-content actions revalidate matching cache tags.
- Priority 7 is now implemented: text search waits for 2+ characters, uses a 300 ms debounce, aborts stale client requests, clamps server-side search limits, and keeps store listing search from applying broad 1-character queries.
- Priority 9 is now implemented: anonymous public pages skip unnecessary Supabase Auth checks when no auth cookie exists, layout state uses verified claims for lightweight customer/cart summary lookups, wishlist uses existing layout customer state instead of its own browser auth request, and public product listing pages no longer fetch full customer data only to compute an unused login flag.
- Priority 8 is now implemented: admin order realtime listens only for `INSERT` and `UPDATE`, order tracking stays scoped to `UPDATE` events for the current order id, admin notifications listen only for `INSERT`, and migration `20260505170000_limit_realtime_publication_tables.sql` removes unused `public.wishlist_items` realtime publication scope.
- Priority 10 is now implemented: the linked development project has no Supabase Storage buckets, product media URLs use `cdn.toycker.in`, review media is stored with provider `r2`, R2 uploads now use explicit file type/size limits, new R2 uploads include long-lived immutable cache metadata, exclusive video uploads are capped at 20MB, and public/admin media previews use lighter preload or lazy-loading behavior where appropriate.
- Full cart retrieval still exists for cart, checkout, cart sidebar detail loading, and cart actions.
- The manually verified layout-state response includes only `customer.id`, `customer.first_name`, `customer.is_club_member`, and cart summary fields such as `id`, `user_id`, `region_id`, `currency_code`, `updated_at`, and `item_count`.
- The manually verified shipping-options response still returns active shipping options after switching the endpoint to lightweight cart summary lookup.
- Manual storefront testing confirmed the homepage renders after public caching changes and no new public-cache-related console errors were present.
- Manual search testing confirmed 1-character text search returns an empty lightweight response, normal searches return capped summary results only, store search still works, and visual search remains unaffected.
- Manual auth testing confirmed anonymous store browsing works without unnecessary `auth/v1/user` requests, guest cart and wishlist redirect behavior still work, logged-in layout state/customer/wishlist behavior still works, cart and checkout still work, logged-out checkout still redirects to login, account pages still gate correctly, and admin access still works.
- Manual price-filter testing confirmed min/max price filters, pagination, sorting, search combination, availability combination, product detail navigation, and existing storefront/admin workflows still work after applying the Priority 3 migration to Toycker Development.
- Priority 8 Supabase verification confirmed both Toycker Development and production `toycker` have migration `20260505170000` applied, `supabase_realtime` contains only `public.admin_notifications` and `public.orders`, and `public.wishlist_items` still exists as a normal table.
- Realtime now exists mainly in admin/order components and is intentionally kept out of public product browsing.

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

### Code-Only After Verification

- `10-media-and-storage-egress-control.md`

Priority 10 was originally classified as `both`, but current Toycker evidence shows media is served from Cloudflare R2/CDN rather than Supabase Storage. No Supabase migration or bucket configuration change was required for this implementation.

### Supabase-Only

- `11-monitoring-and-usage-review.md`

## References

- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase billing FAQ: https://supabase.com/docs/guides/platform/billing-faq
- Supabase Storage bandwidth: https://supabase.com/docs/guides/storage/serving/bandwidth
- Supabase Realtime rate limits: https://supabase.com/docs/guides/realtime/rate-limits
- Supabase database advisors: https://supabase.com/docs/guides/database/database-advisors
