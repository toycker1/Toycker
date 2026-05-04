# Priority 6: Public Storefront Caching

## Classification

`code-only`

## Priority

Do this after reducing payload sizes. Caching smaller payloads gives better results than caching large ones.

## Problem

Public storefront data is often repeated across visitors and page loads. If every request hits Supabase, database request count and egress increase unnecessarily.

Good candidates for caching:

- home banners
- exclusive collections
- categories
- collections
- featured products
- best-selling products
- global settings
- shipping settings that are not cart-specific

## Current Toycker Evidence

Some caching already exists:

- `src/lib/data/home-banners.ts` uses `unstable_cache` with `revalidate: 3600`.
- `src/lib/data/exclusive-collections.ts` uses `unstable_cache` with `revalidate: 3600`.
- `src/lib/data/categories.ts` and `src/lib/data/collections.ts` use `unstable_cache` with a long TTL.

However, some cached queries still select more fields than necessary, for example `home_banners.select("*")` and exclusive collections include product metadata/description.

## Recommended Fix

Keep and extend Next.js caching, but combine it with lighter selects.

Code-only changes:

- Replace `select("*")` in public cached reads with explicit fields.
- Confirm all public homepage/category/collection product rails use cached lightweight product list queries.
- Use consistent cache tags for product, category, collection, banner, and settings changes.
- Keep dynamic/no-store behavior only where user-specific state is required.

Recommended TTL defaults:

- Home banners: 1 hour
- Categories/collections: 1-24 hours
- Public product rails: 10 minutes to 1 hour
- Global settings: 10 minutes to 1 hour

## Expected Impact

- Lower repeated database reads.
- Lower egress for public traffic.
- Faster storefront pages after warm cache.

## Risks / Notes

- Admin changes may not appear immediately unless revalidation tags are correct.
- Do not cache user-specific customer/cart/account data as public data.
- Time-scheduled banners need a TTL that does not leave expired banners visible too long.

## Acceptance Checks

- Public homepage data is cached.
- Category/collection list data is cached.
- Admin updates revalidate or eventually refresh expected content.
- No user-specific data is stored in public cache.

## References

- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
