# Remaining Risk: Media CDN Cache Regression

## Classification

`code-only for the repo`

There is no Supabase change required now. Cloudflare dashboard/cache checks are outside Supabase, but they still matter operationally.

## Status

`Completed and manually verified on 07 May 2026`

The codebase guardrails for this risk have been implemented. Weekly Supabase and Cloudflare monitoring should still continue because CDN/cache behavior can change outside the repo.

## Why This Risk Remains

Production currently serves product media from Cloudflare CDN, not Supabase Storage. That is good.

The remaining risk is a future regression:

- someone uploads media to Supabase Storage
- someone stores Supabase Storage URLs in product rows
- someone removes R2 cache headers
- Cloudflare cache rules bypass static media
- large videos/images are uploaded and served directly

## Current Evidence

Related files:

- `src/lib/actions/storage.ts`
- `src/lib/constants/upload-file-types.ts`
- `src/lib/r2.ts`
- `src/lib/util/images.ts`
- `src/modules/admin/components/image-upload/index.tsx`
- `src/modules/admin/components/image-uploader/index.tsx`
- `src/modules/admin/components/media-manager/index.tsx`
- `src/modules/reviews/utils/upload-review-media.ts`
- `next.config.js`

Production evidence:

- Supabase Storage bucket count: `0`
- product media using Supabase Storage URLs: `0`
- product media using `cdn.toycker.in`: `295`

## Git History To Check First

Before changing uploads, media URLs, R2, CDN behavior, or file limits, inspect Git history for the completed media-egress work:

```powershell
git log --oneline -- src/lib/actions/storage.ts src/lib/constants/upload-file-types.ts src/lib/r2.ts src/lib/util/images.ts next.config.js
git log --oneline -- supabase-free-plan-priorities/10-media-and-storage-egress-control.md
git show --stat <relevant-commit>
```

This is important because Priority 10 already moved the practical controls to Cloudflare R2/CDN upload limits and cache headers. Do not add Supabase Storage usage unless the user explicitly approves a storage strategy change.

## What Is Already Good

- Uploads go through Cloudflare R2.
- New R2 uploads use:

```txt
Cache-Control: public, max-age=31536000, immutable
```

- Product/category/collection/banner images are limited to `5MB`.
- Exclusive videos are limited to `20MB`.
- Review media is limited to `20MB`.
- Public videos use lighter preload behavior.
- Public media URL generation now normalizes keys and direct `.r2.dev` URLs to the configured public CDN host.
- The app preconnects to `cdn.toycker.in`, not the direct R2 public domain.
- Product, category, collection, home banner, exclusive collection, and CSV import write paths block direct Supabase Storage media URLs.
- Admin home-settings exclusive videos are loaded only after clicking the preview, so opening the admin page does not eagerly load every video.
- Review media display paths use the shared public media URL helper.

## Completed Implementation

Code changes made:

1. Added shared media URL helpers in `src/lib/util/media-url.ts`.
2. Updated R2 URL generation to use the shared public CDN helper.
3. Updated image URL normalization to convert keys and direct `.r2.dev` URLs to the CDN host.
4. Updated admin image upload, image uploader, and media manager upload paths to return CDN URLs.
5. Added Supabase Storage URL validation before saving product, category, collection, home banner, and exclusive collection media fields.
6. Added CSV import validation so imported product media cannot save direct Supabase Storage URLs.
7. Removed direct R2 preconnect from the app root layout.
8. Reduced admin home-settings exclusive collection video loading by using poster/product previews until the admin clicks play.
9. Fixed related admin selector/checkbox behavior found during manual Priority 17 testing.

No Supabase migration was created. No new tables were created. No existing tables or RLS policies were changed.

## Verification Completed

Manual verification on 07 May 2026:

1. A test CSV row using `cdn.toycker.in` media imported successfully.
2. A test CSV row using a direct Supabase Storage URL did not save.
3. Searching for `test-bad-supabase-product` in admin products returned no product.
4. Local validator check confirmed CDN URLs pass and Supabase Storage URLs are blocked.
5. Code search found no active Supabase Storage upload/display usage in `src`.
6. Production build completed successfully with `pnpm.cmd build`.

Quality-check notes:

- `pnpm.cmd build` passed.
- `git diff --check` passed.
- `pnpm.cmd exec tsc --noEmit --pretty false` still reports an existing unrelated test type issue in `tests/lib/actions/complete-checkout.test.ts`.
- `pnpm.cmd lint` may still fail because the current repo script uses `next lint`, which resolves `lint` as a project directory in this setup.

## What Can Still Increase Egress

- Uploading oversized media outside the app.
- Serving media through an unproxied or uncached R2 URL.
- Accidentally changing `NEXT_PUBLIC_R2_PUBLIC_URL`.
- Reintroducing Supabase Storage in future code.
- Removing cache headers.

## Recommended Action

Code-only guardrails:

1. Keep all media upload paths using `getPresignedUploadUrl`.
2. Keep upload limits centralized in `upload-file-types.ts`.
3. Keep Supabase Storage calls out of `src`.
4. Keep `cdn.toycker.in` as the public media host.
5. Keep videos lazy or metadata-only unless the user plays them.

Operational Cloudflare checks:

1. Confirm `cdn.toycker.in` is proxied/cached.
2. Confirm R2 custom domain is active.
3. Confirm media responses include useful cache headers.
4. Check Cloudflare cache status for common product images.

## Future Implementation Trigger

Only implement this file if one of these is true:

- Supabase Storage requests or Storage egress become non-zero and keep increasing.
- Product rows start containing `supabase.co/storage` URLs.
- New upload code bypasses `getPresignedUploadUrl`.
- Media files become too large and storefront pages slow down.
- Cloudflare cache is bypassed for `cdn.toycker.in`.

If media still uses Cloudflare CDN and Supabase Storage stays at `0`, no code change is needed.

## Simple Code-Only Plan If Supabase Storage URLs Appear

1. Search the repo for `supabase.storage`, `storage.from`, `getPublicUrl`, and `createSignedUrl`.
2. Search production product/media rows for `supabase.co/storage`.
3. Identify which upload path created those URLs.
4. Move that path back to R2 upload helpers.
5. Keep the existing upload limits.
6. Do not create Supabase Storage buckets.

## Simple Code-Only Plan If Media Files Are Too Large

1. Inspect `src/lib/constants/upload-file-types.ts`.
2. Lower only the needed folder limit.
3. Keep product/category/collection/banner images at `5MB` or lower.
4. Keep videos at `20MB` or lower unless senior approves otherwise.
5. Add client validation and server validation together.
6. Keep user-facing error messages simple.

## Simple Cloudflare Operational Checks

These are not code changes, but they matter:

1. Open a product image URL from `cdn.toycker.in`.
2. Check response headers.
3. Confirm `Cache-Control` is present.
4. Confirm Cloudflare cache status is not always bypassed.
5. Confirm the URL is not a direct Supabase Storage URL.

## How To Avoid Breaking Existing Functionality

- Do not change existing product image URLs unless you know where the replacement file is.
- Do not delete R2 files from code.
- Do not switch media storage providers in a small optimization task.
- Do not reduce upload limits below current real business needs without approval.

## What Not To Do

- Do not store product media in Supabase Storage on the Free Plan.
- Do not allow large original images in product cards.
- Do not autoplay product/review videos.
- Do not remove immutable cache headers for versioned upload keys.

## Testing If Changed Later

1. Upload a product image under `5MB`.
2. Confirm it loads from `cdn.toycker.in`.
3. Confirm DevTools does not show `supabase.co/storage`.
4. Confirm response headers include cache control.
5. Upload invalid/oversized files and confirm rejection.
6. Confirm product page, store page, admin edit page, and reviews still display media.

## References

- Supabase Storage egress optimizations: https://supabase.com/docs/guides/storage/production/scaling
- Cloudflare cache control: https://developers.cloudflare.com/cache/concepts/cache-control/
- Cloudflare R2 cache setup: https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
