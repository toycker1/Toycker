# Priority 1: Lightweight Product Listing Queries

## Classification

`code-only`

## Priority

Do this first. This is likely the highest-impact egress reduction for Toycker.

## Status

`completed`

Completed on: `04 May 2026`

Manual testing status: `passed`

Implementation type: `code-only`

Supabase migration required: `no`

## Implementation Summary

Priority 1 has been implemented in the codebase.

Before the change, listing functions used one heavy product select for both listing pages and detail pages. That meant store/category/collection/home product cards could receive full product detail data, including nested options and related product combinations.

After the change, the product data layer uses two separate select shapes:

```ts
PRODUCT_CARD_SELECT
PRODUCT_DETAIL_SELECT
```

`PRODUCT_CARD_SELECT` is used for product listing/card surfaces. It returns only the data needed for product cards, such as:

```ts
id,
handle,
name,
short_description,
price,
currency_code,
image_url,
thumbnail,
stock_count,
metadata,
category_id,
collection_id,
created_at,
updated_at,
status,
variants:product_variants(...)
```

The variant fields are intentionally kept lightweight but sufficient for price and stock behavior:

```ts
id,
title,
price,
compare_at_price,
inventory_quantity,
manage_inventory,
allow_backorder,
product_id,
image_url,
options
```

`PRODUCT_DETAIL_SELECT` is used for product detail flows. It keeps the fields needed for product pages, variants/options, option values, and related product combinations.

The storefront products API now supports:

```ts
includeDetails?: boolean
```

Normal listing requests do not send this flag, so they receive lightweight product-card data. Quick view sends `includeDetails: true`, so quick view can still load full product variant/option data when opened.

No Supabase schema change or migration was needed because this work only changes which columns and relations the code selects.

## Files Changed

- `src/lib/data/products.ts`
- `src/app/api/storefront/products/route.ts`
- `src/modules/products/components/product-preview/index.tsx`
- `src/modules/products/components/product-preview/quick-view-modal.tsx`

## Manual Testing Completed

The following manual checks were completed successfully:

- Store page product listing works.
- Product cards show images, names, prices, discounts, stock/action state, and links correctly.
- Store sorting/filtering/page interactions still work.
- Product detail pages still load correctly.
- Product detail pages still show variants/options where available.
- Quick view still opens and loads full product data when needed.
- Category and collection product listing pages still work.
- Network response for normal `/api/storefront/products` listing requests is lightweight and does not include full product detail data such as full descriptions, full option relations, related combinations, SEO metadata, or image embeddings.

## Quality Check Status

- `pnpm.cmd build`: passed.
- `pnpm.cmd exec tsc --noEmit`: no Priority 1 errors, but the command still reports an existing unrelated test type issue in `tests/lib/actions/complete-checkout.test.ts`.
- `pnpm.cmd lint`: could not run because the project script uses `next lint`, which is not supported by the installed Next.js setup and is interpreted as an invalid project path.

## Problem

Product listing pages currently appear to fetch product detail data. This increases Supabase database egress because Supabase sends large nested product responses even when the UI only needs product-card information.

Supabase egress includes database responses sent from Supabase to the application or browser. Large query results directly increase egress.

## Current Toycker Evidence

In `src/lib/data/products.ts`, `PRODUCT_SELECT` includes:

```ts
*,
variants:product_variants(*),
options:product_options(*, values:product_option_values(*)),
related_combinations:product_combinations!product_id(
  *,
  related_product:products!related_product_id(
    *,
    variants:product_variants(*),
    options:product_options(*, values:product_option_values(*))
  )
)
```

This select is used by listing functions such as `listProducts` and `listPaginatedProducts`, not only product detail functions.

Affected surfaces likely include:

- Homepage product rails
- Store page
- Category pages
- Collection pages
- Search/storefront product APIs
- Related product cards if they reuse list functions

## Recommended Fix

Create separate select shapes in code:

```ts
PRODUCT_CARD_SELECT
PRODUCT_DETAIL_SELECT
```

Use `PRODUCT_CARD_SELECT` on list/card pages. It should include only fields needed to render a product card, such as:

```ts
id,
name,
handle,
image_url,
thumbnail,
price,
compare_at_price,
currency_code,
stock_count,
status,
created_at
```

Use `PRODUCT_DETAIL_SELECT` only for:

- product detail page
- product edit/admin detail flows
- any workflow that truly needs variants, options, option values, combinations, and related full products

Do not remove detail data globally. Split the query usage by screen.

## Expected Impact

- Large reduction in database response size on public browsing pages.
- Lower egress per page view.
- Faster storefront responses because less JSON must be transferred and parsed.

## Risks / Notes

- Product cards may rely on fields not obvious at first, such as `metadata`, `images`, or variant prices.
- Check `ProductPreview`, `ProductRail`, category pages, collection pages, and best-selling sections before finalizing the lightweight field list.
- If product card price is derived from cheapest variant, either include only the minimal variant price data or solve it with a database-side computed field later.

## Acceptance Checks

- Product listing pages still render image, title, price, stock state, links, and discounts correctly.
- Product detail pages still show variants, options, related products, and full content.
- Network/API responses for listing pages are visibly smaller.
- TypeScript passes.
- Store, category, collection, homepage rails, and product detail pages are manually checked.

## References

- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
