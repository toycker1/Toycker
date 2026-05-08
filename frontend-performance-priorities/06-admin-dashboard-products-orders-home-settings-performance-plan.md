# Priority 6: Admin Dashboard, Products, Orders, And Home Settings Performance Plan

Status: Pending implementation
Change type: code-only, with media/CDN support for admin uploads
Supabase migration required: No by default

## Goal

Keep admin pages usable without loading unnecessary data, media, or heavy JavaScript on every admin screen.

Admin pages do not need the same Lighthouse score as public storefront pages. But they must not freeze, load all records, or accidentally increase Cloudflare/Supabase traffic through repeated media previews.

## Pages Covered

- Admin dashboard: `/admin`
- Admin products: `/admin/products`
- Admin product detail: `/admin/products/[id]`
- Admin product import/export
- Admin orders: `/admin/orders`
- Admin order detail: `/admin/orders/[id]`
- Admin customers: `/admin/customers`
- Admin collections: `/admin/collections`
- Admin categories: `/admin/categories`
- Admin reviews: `/admin/reviews`
- Admin inventory: `/admin/inventory`
- Admin discounts: `/admin/discounts`
- Admin home settings: `/admin/home-settings`
- Admin settings: `/admin/settings`
- Admin global search

## Current Good Work Already Done

Priority 16 addressed admin dashboard, export, import, and backfill egress risks.

Before implementation, check:

```bash
git log --oneline --grep="admin"
git log --oneline --grep="export"
git log --oneline --grep="import"
git log --oneline -- src/app/admin src/modules/admin src/lib/data/admin.ts src/lib/data/analytics.ts
```

## Admin Product List Risks

Main files:

- `src/app/admin/products/page.tsx`
- `src/modules/admin/components/product-csv-import.tsx`
- `src/app/api/admin/products/export/route.ts`
- `src/app/api/admin/products/import/route.ts`

Risks:

- Product list can load too many fields.
- Import/export can process huge CSVs.
- Product thumbnails can request broken or unoptimized media URLs.

What to do:

- Keep admin product list paginated.
- Show only image, name, handle, status, inventory, and price when needed.
- Keep export explicit and user-triggered.
- Validate import template column count.
- Avoid showing full product descriptions in list.

## Admin Product Detail Risks

Main files:

- `src/app/admin/products/[id]/page.tsx`
- `src/modules/admin/components/edit-product-form.tsx`
- `src/modules/admin/components/media-manager/index.tsx`
- `src/modules/admin/components/image-uploader/index.tsx`
- `src/modules/admin/components/rich-text-editor.tsx`

Risks:

- Rich text editor is heavy.
- Media manager can load many images/videos.
- Product detail is allowed to be heavier, but should not affect public storefront bundles.

What to do:

- Keep editor admin-only.
- Lazy-load rich text editor.
- Use media thumbnails/posters.
- Do not autoplay all media.
- Enforce upload size guidance.

## Admin Orders Risks

Main files:

- `src/app/admin/orders/page.tsx`
- `src/app/admin/orders/[id]/page.tsx`
- `src/modules/admin/components/realtime-orders-listener.tsx`

Risks:

- Realtime can create unnecessary messages if too broad.
- Order list can load nested details unnecessarily.
- Order detail can load item media.

What to do:

- Keep realtime scoped only to needed order tables/events.
- Keep order list summary-only.
- Load full order detail only on detail page.
- Use small thumbnails.

## Admin Home Settings Risks

Main files:

- `src/app/admin/home-settings/page.tsx`
- `src/app/admin/home-settings/home-settings-client.tsx`
- `src/modules/admin/components/home-settings/banners-manager`
- `src/modules/admin/components/home-settings/exclusive-collections-manager`
- `src/modules/admin/components/home-settings/reviews-manager`

Known issues from testing:

- Home settings can show repeated video requests when exclusive collections are opened.
- Highlighted product dropdown previously needed attention.
- Runtime duration is display/control metadata, not something that should force video preload.

What to do:

- Render poster/thumbnail by default.
- Load video only when preview is explicitly opened.
- Keep product selector lightweight and stable.
- Avoid repeated video previews on list render.
- Keep admin media cache behavior visible in Network tests.

## Admin Global Search Risks

Main files:

- `src/modules/admin/components/admin-global-search.tsx`
- `src/app/api/admin/search/backfill/route.ts`

Risks:

- Global search can fetch too much.
- Backfill routes can be expensive.

What to do:

- Keep result payload small.
- Debounce admin search.
- Keep backfill explicit/admin-only.
- Never run backfill automatically from normal page render.

## Manual Testing

Admin products:

1. Open `/admin/products`.
2. Search products.
3. Change tabs: All, Active, Draft, Archived.
4. Import valid CSV and invalid CSV in development.
5. Export only when clicked.

Admin product detail:

1. Open a product with many images.
2. Confirm media manager does not autoplay all media.
3. Edit a field and save.
4. Confirm storefront still shows updated product.

Admin home settings:

1. Open `/admin/home-settings`.
2. Open banners manager.
3. Open exclusive collections.
4. Confirm videos do not all download immediately.
5. Upload/select media in development.
6. Confirm cache headers for uploaded media.

Admin orders:

1. Open `/admin/orders`.
2. Open order detail.
3. Mark fulfillment/payment actions if safe in development.
4. Confirm realtime notifications still work.

## Expected Result

- Admin remains functional.
- Admin-only heavy packages do not affect public pages.
- Media previews do not cause repeated large downloads.
- Import/export stays explicit and controlled.
