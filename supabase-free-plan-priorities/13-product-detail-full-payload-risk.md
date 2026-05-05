# Remaining Risk: Product Detail Full Payload

## Classification

`code-only`

No Supabase migration is required now.

## Why This Risk Remains

Product detail pages still need more data than product listing pages. That is normal.

In `src/lib/data/products.ts`, listing pages use `PRODUCT_CARD_SELECT`, while product detail pages use `PRODUCT_DETAIL_SELECT`.

`PRODUCT_DETAIL_SELECT` includes:

- product description and SEO fields
- product variants
- product options and option values
- related product combinations
- product images and video URL

This is correct for `/products/[handle]`, but it means product detail pages will always send more database data than product listing pages.

## Current Evidence

Related files:

- `src/lib/data/products.ts`
- `src/app/(main)/products/[handle]/page.tsx`
- `src/modules/products/templates/index.tsx`
- `src/modules/products/components/image-gallery/index.tsx`
- `src/modules/products/components/product-preview/index.tsx`
- `src/modules/products/components/product-preview/quick-view-modal.tsx`

Production evidence:

- `products`: about `295` rows
- `product_variants`: about `41` rows
- product media URLs using Supabase Storage: `0`
- product media URLs using `cdn.toycker.in`: `295`

The main Supabase risk is database payload, not Supabase Storage.

## Git History To Check First

Before changing product detail or quick-view behavior, inspect Git history for the completed product-query work:

```powershell
git log --oneline -- src/lib/data/products.ts src/modules/products src/modules/store
git log --oneline -- supabase-free-plan-priorities/01-lightweight-product-listing-queries.md
git show --stat <relevant-commit>
```

This is important because priorities 1, 2, and 3 already changed product listing, pagination, and price filtering. Do not undo those changes.

## What Is Already Good

- Listing pages no longer use the full detail select.
- Related products inside product detail use the lightweight card select.
- YouTube iframes are lazy-loaded.
- Product media comes from Cloudflare CDN, not Supabase Storage.

## What Can Still Increase Egress

- Heavy traffic directly to product detail pages.
- Product detail pages with many images, options, variants, or related products.
- Quick view usage if it fetches full detail repeatedly.
- Search engines or bots crawling every product page.

## Recommended Action

Do not change this immediately unless monitoring shows product detail traffic is high.

If it becomes a problem, make code-only changes:

1. Keep the main product detail query as-is for the product page.
2. Make quick view use a smaller `PRODUCT_QUICK_VIEW_SELECT` instead of full product detail.
3. Limit related products returned in product detail.
4. Keep product detail route revalidation at a small but useful TTL.
5. Keep large text fields out of any modal/card API response.

## Implementation Trigger

Only implement this file if one of these is true:

- Supabase logs show product detail queries are among the top egress sources.
- Product detail pages are receiving much more traffic than listing pages.
- Quick view or modal usage is repeatedly fetching full product detail data.
- Product rows become much larger because of added metadata, long descriptions, many images, or many related products.

If none of these are true, do not change product detail code.

## Simple Implementation Plan If Needed

Keep the scope narrow:

1. Inspect `src/lib/data/products.ts`.
2. Confirm which caller needs full details and which caller only needs preview details.
3. Keep `PRODUCT_DETAIL_SELECT` for `/products/[handle]`.
4. Add a small `PRODUCT_QUICK_VIEW_SELECT` only if quick view is confirmed as the problem.
5. Make the quick-view caller use the smaller select.
6. Do not change listing queries, because Priority 1 already handled those.
7. Do not change product table schema.

Suggested quick-view fields:

```txt
id
handle
name
short_description
price
currency_code
image_url
thumbnail
stock_count
status
variants(id,title,price,compare_at_price,inventory_quantity,manage_inventory,allow_backorder,product_id,image_url,options)
```

Do not include:

```txt
description
seo_metadata
all related_combinations
large metadata
all option value metadata
```

Only include these later if the UI visibly needs them.

## How To Avoid Breaking Existing Functionality

- Product detail page must still use full data.
- Add-to-cart must still receive variant and inventory data.
- Wishlist must still work.
- Product image gallery must still show the correct media.
- Related products must still appear on product detail pages.
- Quick view can be smaller, but it must still show enough data to select a variant and add to cart if that is supported.

## What Not To Do

- Do not remove variants/options from the real product detail page if users need them to buy.
- Do not create a migration until there is a measured query performance problem.
- Do not move media to Supabase Storage.

## Testing If Changed Later

1. Open `/store`.
2. Open a product detail page.
3. Confirm product images, variants, options, price, related products, wishlist, and add-to-cart still work.
4. Open quick view if available.
5. Confirm quick view still shows only the fields users need.
6. In Network, check that product card/listing payloads are still smaller than product detail payloads.

## References

- Supabase recommends reducing selected fields and entries to reduce egress: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Next.js caching and revalidation guidance: https://nextjs.org/docs/app/guides/caching
