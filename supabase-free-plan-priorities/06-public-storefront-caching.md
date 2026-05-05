# Priority 6: Public Storefront Caching

## Status

Completed.

- Completed on: 05 May 2026
- Manual testing status: passed
- Implementation type: `code-only`
- Supabase migration required: `no`
- Supabase dashboard/config change required: `no`

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

Implementation update:

- Public cached reads now use explicit field selections for home banners, exclusive collections, category detail, and global settings.
- Storefront home reviews now use `unstable_cache` with `revalidate: 3600` and tag `home-reviews`.
- Storefront home reviews select only needed review media fields instead of `review_media (*)`.
- Admin home banner, exclusive collection, and home review mutations now revalidate matching cache tags.
- Full cart, customer, account, checkout, wishlist, and other user-specific data paths were not cached.
- Manual testing confirmed the homepage renders correctly after the caching changes and no new public-cache-related console errors were present.

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

- Public homepage data is cached. Passed on 05 May 2026.
- Category/collection list data is cached. Passed on 05 May 2026.
- Admin updates revalidate or eventually refresh expected content. Implemented with cache tags on 05 May 2026.
- No user-specific data is stored in public cache. Passed on 05 May 2026.

## Implementation Summary

Files changed:

- `src/lib/data/home-banners.ts`
- `src/lib/data/exclusive-collections.ts`
- `src/lib/data/categories.ts`
- `src/lib/data/settings.ts`
- `src/lib/actions/home-reviews.ts`
- `src/lib/actions/home-banners.ts`
- `src/lib/actions/home-exclusive-collections.ts`

Public reads now avoid broad payloads such as:

```ts
select("*")
```

where the storefront only needs a small field set.

Storefront home reviews are now cached with:

```ts
unstable_cache(..., ["home-reviews", "storefront"], {
  revalidate: 3600,
  tags: ["home-reviews"],
})
```

Admin changes revalidate relevant public cache tags:

- `banners`
- `exclusive-collections`
- `home-reviews`

Manual browser testing showed the homepage hero/banner area and public storefront sections still render correctly after these changes.

## Quality Check Status

- Build: passed with `pnpm.cmd build`
- TypeScript: blocked only by existing unrelated `tests/lib/actions/complete-checkout.test.ts` error
- Lint: blocked by existing `next lint` script issue
- New `any` usage: none added in touched files

## References

- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
