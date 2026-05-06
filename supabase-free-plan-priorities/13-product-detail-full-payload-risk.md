# Remaining Risk: Product Detail Full Payload

## Classification

`code-only`

Status: Completed and manually verified on 06 May 2026.

No Supabase migration was required.

No new tables were created. No existing tables were changed. No RLS policies, indexes, RPCs, or database functions were added or changed.

## What Was Implemented

The real product detail page still needs more data than product listing pages. That is normal.

The completed change reduces the quick-view/modal payload without reducing the real product detail page payload.

In `src/lib/data/products.ts`:

- listing pages use `PRODUCT_CARD_SELECT`
- quick-view requests now use `PRODUCT_QUICK_VIEW_SELECT`
- real product detail pages and admin product detail/edit still use `PRODUCT_DETAIL_SELECT`

`PRODUCT_DETAIL_SELECT` includes:

- product description and SEO fields
- product variants
- product options and option values
- related product combinations
- product images and video URL

This is correct for `/products/[handle]`, but it means product detail pages will always send more database data than product listing pages.

`PRODUCT_QUICK_VIEW_SELECT` intentionally excludes heavy full-detail fields that quick view does not need:

- `description`
- `seo_title`
- `seo_description`
- `seo_metadata`
- `video_url`
- `related_combinations`

Quick view still receives the fields needed for display, variant selection, and add-to-cart:

- product id, handle, name, short description, price, image URLs, stock, status
- variants with price, inventory, image URL, and options
- product options and option values

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

Implementation evidence:

- `src/lib/data/products.ts` has a dedicated `PRODUCT_QUICK_VIEW_SELECT`.
- `/api/storefront/products` keeps the same request contract, but `includeDetails: true` now uses the quick-view select instead of the full detail select.
- `src/modules/products/components/product-preview/quick-view-modal.tsx` avoids refetching the same hydrated quick-view product while the same product card remains mounted.
- `src/app/(main)/products/[handle]/page.tsx` no longer uses `images as any`; product images are mapped with typed image URL handling.

Manual verification evidence:

- The quick-view API response for product `prod_7289a65d-093e-4263-ab7f-cae17e94ada9` included `variants`, `options`, `images`, price, and stock fields.
- The same response did not include `description`, `seo_metadata`, `video_url`, or `related_combinations`.
- Product images in that response were Cloudflare CDN URL strings from `cdn.toycker.in`, not Supabase Storage file bytes.
- The user confirmed the quick-view response was inspected and accepted.

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

## Completed Action

Completed code-only changes:

1. Kept the main product detail query as-is for the product page.
2. Added a smaller `PRODUCT_QUICK_VIEW_SELECT`.
3. Made quick view use the smaller select through the existing `/api/storefront/products` route.
4. Kept large full-detail fields out of the modal/card API response.
5. Did not change listing queries, cart, checkout, search, admin flows, or Supabase schema.

## Implementation Trigger

This risk has already been implemented because quick view was confirmed to be able to fetch full product detail data repeatedly.

Future changes should only revisit this file if one of these is true:

- Supabase logs show product detail queries are among the top egress sources.
- Product detail pages are receiving much more traffic than listing pages.
- Quick view or modal usage again starts returning full product detail data.
- Product rows become much larger because of added metadata, long descriptions, many images, or many related products.

If none of these are true, do not change product detail code further.

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

## Testing Completed

1. Opened `/store`.
2. Called the quick-view product API with `includeDetails: true`, `limit: 1`, and a product id.
3. Confirmed the response includes the fields quick view needs.
4. Confirmed the response does not include heavy full-detail fields.
5. Confirmed the real product detail page still uses full product detail data.
6. Confirmed no Supabase migration was needed.

Quality checks:

- `pnpm.cmd build` passed.
- `git diff --check` passed.
- `pnpm.cmd exec tsc --noEmit` still has the known unrelated test type issue under `tests/lib/actions/complete-checkout.test.ts`.
- `pnpm.cmd lint` still has the known current repo script issue where `next lint` resolves `lint` as a project directory.

## References

- Supabase recommends reducing selected fields and entries to reduce egress: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Next.js caching and revalidation guidance: https://nextjs.org/docs/app/guides/caching
