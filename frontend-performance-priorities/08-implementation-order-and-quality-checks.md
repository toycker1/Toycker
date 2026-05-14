# Priority 8: Implementation Order And Quality Checks

Status: Implemented and manually verified
Change type: planning and verification
Supabase migration required: No

## Goal

Define a safe implementation order so frontend performance improves without breaking Toycker's existing shopping, checkout, admin, or Supabase egress work.

## Safe Implementation Order

### Phase 1: Measurement

Change type: code-only or documentation-only

Do:

- Record current Lighthouse metrics for key pages.
- Record Network request count and transfer size.
- Record largest images/videos/scripts.
- Keep screenshots/reports.

Do not:

- Change code before having baseline numbers.

### Phase 2: Hero And Homepage Media

Change type: both code + Cloudflare/media

Do:

- Optimize active hero/banner assets.
- Ensure only one LCP image is priority/eager.
- Add correct `sizes`.
- Keep below-the-fold media lazy.

Why first:

- Lighthouse directly shows the homepage hero image as a major problem.
- This is likely the fastest visible improvement.

### Phase 3: Cloudflare Cache And Upload Rules

Change type: Cloudflare/media and small code support

Do:

- Ensure immutable media gets long cache headers.
- Ensure new uploads use versioned filenames.
- Add upload guidance/validation where simple.

Why:

- Prevents future media cache regressions.
- Reduces repeat-visit bandwidth.

### Phase 4: Third-Party Scripts

Change type: code-only

Do:

- Delay Contentsquare.
- Review GTM loading strategy.
- Keep Meta Pixel off admin routes.
- Keep analytics environment-gated.

Why:

- TBT is very high.
- Third-party scripts are visible in Lighthouse.

### Phase 5: Global Providers

Change type: code-only

Do:

- Split or lazy-load global providers carefully.
- Keep cart/wishlist/header behavior correct.
- Delay chatbot if possible.

Why:

- Root provider work affects every public page.

### Phase 6: Store/Product Image Loading

Change type: code-only + media/CDN

Do:

- Tune product card images.
- Tune product gallery images.
- Lazy-load non-visible media.
- Preserve Supabase lightweight payload work.

### Phase 7: Admin Media And Heavy Packages

Change type: code-only

Do:

- Lazy-load admin editors/charts/media previews.
- Avoid many autoplay videos.
- Keep import/export explicit.

### Phase 8: Bundle Audit

Change type: code-only

Do:

- Run bundle analyzer.
- Remove or dynamically import heavy code where safe.

## Required Quality Checks

Run these after implementation:

```bash
pnpm.cmd build
pnpm.cmd exec tsc --noEmit
pnpm.cmd lint
```

Known caveat:

- If `pnpm.cmd lint` fails because the project uses a newer Next.js setup where `next lint` is unavailable or misresolved, report that clearly.
- If `tsc` fails because of unrelated existing test files, report the exact file and do not hide it.

Also run:

```bash
git diff --check
```

## Required Manual Tests

Public:

- Home loads and carousel works.
- Store pagination/filter/sort works.
- Search drawer works.
- Visual search works.
- Product detail gallery works.
- Add to cart works.
- Wishlist add/remove works.

Checkout:

- Cart totals correct.
- Address step works.
- Shipping step works.
- Payment step works.
- Payment discount appears only where intended.
- Order confirmation works in development/test flow.

Account:

- Login works.
- Account dashboard works.
- Order history works.
- Order detail works.
- Address book works.

Admin:

- Dashboard loads.
- Product list and product detail work.
- Import/export still explicit.
- Orders list/detail work.
- Home settings banner/exclusive/review managers work.
- Media upload/preview works.

Performance:

- Run Lighthouse mobile before and after.
- Compare LCP, TBT, Speed Index, total transferred size, request count.
- Check DevTools Network for large images and third-party scripts.

## What Counts As A Regression

Do not accept the change if:

- Checkout is slower or incorrect.
- Product detail images break.
- Cart/wishlist badges stop updating.
- Admin cannot upload media.
- Admin product import/export breaks.
- Product search returns wrong results.
- Media disappears from homepage.
- Analytics required by the business stops loading completely without approval.

## Expected Overall Result

After implementation, Toycker should:

- Load homepage visual content faster.
- Download less media on first load.
- Do less JavaScript work before interaction.
- Keep Supabase egress improvements intact.
- Keep Cloudflare as the source for media storage/delivery.
- Keep all shopping and admin workflows functional.

## Implementation Status

Completed on: 2026-05-13

Supabase migration result:

- No Supabase migration was required.
- No Supabase migration file was created.

What was verified:

- The frontend performance priorities were implemented in the planned order.
- Priority 8 was used as the final quality gate for the earlier frontend performance work.
- The lint command was updated to use the ESLint CLI directly because the old `next lint` command is not valid for this Next.js setup.
- JSX text escaping issues that blocked lint were fixed without changing page behavior.
- The production build regenerated the service worker output.
- A related cart responsive layout issue found during manual testing was fixed so mobile and tablet cart items show the product image first, then product details, then quantity on the left and remove on the right.

Quality checks completed:

```bash
pnpm.cmd lint
pnpm.cmd exec tsc --noEmit
pnpm.cmd build
git diff --check
```

Result:

- Lint passed with warnings only.
- TypeScript passed.
- Production build passed.
- Whitespace check passed with line-ending warnings only.
