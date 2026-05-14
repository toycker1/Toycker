# Priority 7: JavaScript, Third-Party Scripts, Providers, And PWA Performance Plan

Status: Implemented and manually verified
Change type: code-only
Supabase migration required: No

## Goal

Reduce Total Blocking Time and main-thread work without breaking analytics, cart, wishlist, chatbot, PWA, or admin behavior.

The Lighthouse report showed:

- Total Blocking Time: 1,200ms
- Reduce JavaScript execution time: about 3.7s
- Minimize main-thread work: about 8.1s
- Reduce unused JavaScript: about 318 KB
- Third-party scripts include GTM, Facebook, and Contentsquare.

## Current Code Signals

Root layout:

- `src/app/layout.tsx`

Global providers:

- `src/app/providers.tsx`

Analytics:

- `src/lib/analytics/index.tsx`
- `src/lib/analytics/meta-pixel.tsx`
- `src/instrumentation-client.ts`

Service worker:

- `src/sw.ts`

Heavy dependencies:

- `@xenova/transformers`
- `@tiptap/react`
- `recharts`
- `swiper`
- `papaparse`
- `react-icons`
- `@stripe/react-stripe-js`
- `@sentry/nextjs`

## Third-Party Script Risks

Current behavior:

- GTM is loaded in root layout.
- Contentsquare uses `strategy="beforeInteractive"`.
- Meta Pixel uses `afterInteractive`.
- Vercel Analytics and Speed Insights load globally.

Risk:

- Third-party scripts can block or compete with initial rendering.
- Contentsquare beforeInteractive is especially risky for homepage LCP/TBT.
- Marketing scripts can add JavaScript, network requests, and long tasks.

What to do:

- Move Contentsquare away from `beforeInteractive` unless business requires immediate recording.
- Prefer `lazyOnload` or delayed loading after user interaction/idle.
- Keep Meta Pixel disabled on admin routes.
- Consider delaying GTM on public pages until after the first render.
- Keep analytics environment-gated.
- Do not remove analytics permanently without approval.

## Global Provider Risks

Current providers wrap every page:

- Layout data
- Toast
- Cart store
- Shipping price
- Cart sidebar
- Wishlist
- Chatbot
- PWA

Risk:

- Every page pays for providers even if it does not need them immediately.
- Some providers can fetch auth/cart/wishlist/customer state.
- Chatbot and PWA logic can add client-side work.

What to do:

- Split providers by route group where practical.
- Keep only essential UI providers globally.
- Move cart/wishlist hydration closer to header/cart UI.
- Lazy-load chatbot after idle or when launcher is visible.
- Do not mount chatbot on admin pages unless needed.
- Keep PWA prompt lightweight and avoid blocking render.

## Bundle Risks

Potentially heavy packages should stay route-specific:

- `@xenova/transformers`: visual search only.
- `@tiptap/react`: admin product editor/review editor only.
- `recharts`: admin dashboard only.
- `papaparse`: admin import/export only.
- `@stripe/react-stripe-js`: checkout payment step only.
- `swiper` or carousel libraries: only where needed.

What to do:

- Run bundle analyzer.
- Confirm storefront homepage does not include admin/editor/import/search-model code.
- Dynamically import heavy optional components.
- Avoid importing full icon libraries when small direct icons exist.

## PWA/Service Worker Risks

Current service worker:

- `src/sw.ts`
- Uses Serwist default cache.
- Uses navigation preload.

What repeated requests mean:

- Network panel can show `sw.js` as initiator even when data comes from disk cache or service worker cache.
- This is not always bad.
- Check transferred bytes, status, and cache source before assuming a real network download.

What to do:

- Keep service worker caching.
- Avoid caching broken 404 media.
- Avoid prefetching huge media.
- Ensure cache rules do not replay many videos unnecessarily.

## Manual Testing

Third-party scripts:

1. Open live homepage in Incognito.
2. Run Lighthouse.
3. Expand third-party and unused JavaScript sections.
4. Note GTM, Facebook, Contentsquare, Sentry, Vercel entries.
5. After implementation, verify scripts still fire where required.

Providers:

1. Open homepage.
2. DevTools Network: filter Fetch/XHR.
3. Record initial API calls.
4. Open store, product detail, cart, checkout, admin.
5. Confirm only necessary user/cart/wishlist requests happen.

Bundle:

1. Run:

```bash
pnpm.cmd analyze
```

2. Confirm admin-only packages are not in public storefront bundles.

## Expected Result

- Lower TBT through less global client-side provider work.
- Less main-thread work by keeping storefront-only providers out of admin routes.
- Fewer initial scripts before the page is usable by lazy-loading analytics and chatbot shell where possible.
- Same analytics behavior on public storefront pages where business-critical.
- Same cart/wishlist/chatbot/PWA behavior after page is interactive.
- Admin routes do not load storefront layout state, chatbot, Facebook, GTM, or Contentsquare scripts.
- PWA service worker registers in production and avoids dedicated audio/video runtime caches.

## Implementation Notes

- No Supabase migration was required.
- Root providers were reduced to shared toast UI only.
- Storefront and checkout provider stacks were moved into route-group layouts.
- Chatbot/contact hub loading was delayed on public storefront pages and kept out of admin.
- Third-party analytics were route-gated so admin pages do not load marketing scripts.
- Contentsquare and Meta Pixel were moved to later loading strategies.
- Sentry client setup now runs only when a DSN is configured, with lower sampling.
- PWA registration was delayed until after page load/idle time.
- Service worker caching was adjusted to avoid dedicated audio/video media caches.

## Verification Completed

- `pnpm.cmd build` completed successfully.
- Targeted ESLint passed for changed Priority 7 files.
- TypeScript check passed.
- Production start was tested locally after build.
- Admin Network tab searches returned no results for `layout-state`, `chatbot`, `facebook`, `googletagmanager`, and `contentsquare`.
- Service worker registration was verified in production mode with `/sw.js` active.

## Sources

- Next.js Script docs: https://nextjs.org/docs/app/api-reference/components/script
- Next.js lazy loading docs: https://nextjs.org/docs/app/guides/lazy-loading
- Chrome TBT docs: https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time
- Chrome JavaScript execution audit: https://developer.chrome.com/docs/lighthouse/performance/bootup-time
- Web.dev INP: https://web.dev/articles/inp
