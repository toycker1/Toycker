# Priority 1: Lightweight Product Listing Queries

## Classification

`code-only`

## Priority

Do this first. This is likely the highest-impact egress reduction for Toycker.

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
