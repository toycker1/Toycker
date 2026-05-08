# Priority 4: Store, Search, And Product Detail Performance Plan

Status: Pending implementation
Change type: mostly code-only; media/CDN support for images
Supabase migration required: No by default

## Goal

Keep catalog browsing fast without reintroducing heavy Supabase responses or large media downloads.

## Pages Covered

- Store: `/store`
- Category pages: `/categories/[handle]`
- Collection pages: `/collections/[handle]`
- Search drawer/modal
- Visual search: `/search/visual`
- Product detail: `/products/[handle]`
- Recently viewed
- Related products
- Frequently bought together

## Current Good Work Already Done

The Supabase egress priorities already reduced many backend payload risks:

- Product listing uses lighter product selects.
- Database pagination exists.
- Price filtering was moved into database logic.
- Search payloads were reduced.
- Visual search no longer returns huge embedding/product payloads.
- Product detail full payload risk was addressed.

Before making changes, check:

```bash
git log --oneline --grep="product"
git log --oneline --grep="search"
git log --oneline -- supabase-free-plan-priorities src/lib/data/products.ts src/lib/data/search.ts src/app/api/storefront
```

## Store Listing Risks

Main files:

- `src/app/(main)/store/page.tsx`
- `src/modules/store/templates/index.tsx`
- `src/modules/store/templates/paginated-products.tsx`
- `src/modules/store/components/product-grid-section/index.tsx`
- `src/app/api/storefront/products/route.ts`
- `src/lib/data/products.ts`

Risks:

- Too many product images can download if cards are eagerly loaded.
- Store hover/prefetch behavior can create extra network requests.
- Product cards must not request full product detail data.
- Search/filter interactions should not trigger duplicate requests.

What to do:

- Keep public listing response lightweight.
- Keep pagination server/database-level.
- Use thumbnail-sized images.
- Lazy-load offscreen cards.
- Disable unnecessary route prefetch for large product-detail pages when it causes extra requests.
- Keep filter drawer state lightweight.

## Search Drawer Risks

Main files:

- `src/modules/layout/components/search-drawer/index.tsx`
- `src/modules/layout/hooks/useSearchResults.ts`
- `src/app/api/storefront/search/route.ts`
- `src/lib/data/search.ts`

Risks:

- Search can fire too often while typing.
- Search suggestions can fetch images/products repeatedly.
- Large response payloads can return if detail fields are added later.

What to do:

- Keep debounce.
- Keep minimum query length.
- Return only id, title/name, handle, thumbnail, and price.
- Do not return descriptions, images arrays, metadata, variants, or embeddings.
- Keep request cancellation if supported.

## Visual Search Risks

Main files:

- `src/app/(main)/search/visual/page.tsx`
- `src/modules/search/components/VisualSearchInterface/index.tsx`
- `src/app/api/storefront/search/image/route.ts`
- `src/lib/ml/embeddings.ts`

Current status:

- Payload size was optimized in Priority 15.
- Remaining risk is mostly request volume and CPU cost, not response size.

What to do:

- Keep rate limiting.
- Keep result payload lightweight.
- Do not return `image_embedding`, `search_vector`, `description`, `seo_metadata`, full images arrays, or variants.
- Show only result cards.
- Avoid repeated searches while crop box is moving.

## Product Detail Risks

Main files:

- `src/app/(main)/products/[handle]/page.tsx`
- `src/modules/products/templates/index.tsx`
- `src/modules/products/components/image-gallery/index.tsx`
- `src/modules/products/components/product-tabs/index.tsx`
- `src/modules/products/components/related-products/index.tsx`
- `src/modules/products/components/frequently-bought-together/index.tsx`
- `src/modules/products/components/customer-reviews/index.tsx`

Risks:

- Product gallery can load many images.
- Product descriptions can be long but are needed on detail page.
- Related products should use lightweight card data.
- Reviews can include media.
- Recently viewed tracking should not generate large requests.

What to do:

- Only first gallery image should be eager/priority.
- Lazy-load thumbnails and zoom images.
- Use correct `sizes`.
- Keep related product data lightweight.
- Lazy-load review media.
- Do not load videos until visible or clicked.

## Manual Testing

Store:

1. Open `/store`.
2. Open DevTools Network.
3. Filter by `/api/storefront/products`.
4. Change page, sort, price filter, availability, and grid/list view.
5. Confirm responses are small and product cards still work.

Search:

1. Open search drawer.
2. Type `car`.
3. Confirm only lightweight results appear.
4. Confirm no full product payload appears.

Product detail:

1. Open a product with many images.
2. Confirm first image loads quickly.
3. Open gallery/zoom.
4. Confirm later images load only when needed.
5. Add to cart.
6. Confirm checkout still works.

Visual search:

1. Open `/search/visual`.
2. Upload/crop image.
3. Confirm response includes only lightweight fields.
4. Confirm in-stock/out-of-stock button is correct.

## Expected Result

- Store and search remain fast as product count grows.
- Product detail still has complete product information, but media loads progressively.
- Supabase does not return heavy search/listing payloads.
- Cloudflare media bandwidth decreases when images are optimized.
