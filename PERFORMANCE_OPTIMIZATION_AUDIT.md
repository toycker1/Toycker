# Toycker Performance and Optimization Audit

Date: 2026-04-30

This document explains where Toycker should be optimized first, why those areas matter, and how the Supabase Advisor warnings fit into the overall performance plan.

## Short Answer

Yes, the Supabase Advisor performance warnings should be resolved, but they should be handled with the same care as production code changes.

The correct industry-level approach is:

1. Fix high-confidence Supabase Advisor issues that affect hot or sensitive tables.
2. Measure real production performance with Web Vitals, Supabase slow query data, and build/bundle output.
3. Optimize the highest-traffic user flows first: home, product listing, product detail, cart, checkout, and search.
4. Avoid random optimization. Every change should have a reason, a test, and a before/after measurement.

For Toycker, I would start with the Supabase Advisor database warnings and the product listing query shape because those directly affect all users and will get worse as traffic and data grow.

## What I Checked

I reviewed the local Next.js, TypeScript, Tailwind CSS, and Supabase project structure, including:

- `next.config.js`
- `src/app/layout.tsx`
- `src/app/providers.tsx`
- storefront pages under `src/app/(main)`
- checkout routes under `src/app/(checkout)`
- API routes under `src/app/api`
- Supabase data helpers under `src/lib/data`
- global providers for cart, wishlist, chatbot, layout state, and PWA
- product listing, search, cart, checkout, and home page flows
- Supabase migrations under `supabase/migrations`
- local static media under `public/assets`

I also ran a production build:

```txt
pnpm.cmd build
```

Result:

- Build succeeded.
- Next.js version: `16.1.3`.
- Production compilation took about `120s`.
- Static generation produced `357` pages.
- Many customer/admin/account routes are dynamic.
- The root route `/` is dynamic.
- Product pages are dynamic with `revalidate = 60`.

## Research Sources Used

I checked current official documentation and performance references, including these topics:

- Next.js image optimization
- Next.js caching and revalidation
- Next.js lazy loading
- Next.js package bundling
- Next.js Script and third-party loading
- Supabase Performance and Security Advisors
- Supabase RLS performance
- Supabase query optimization
- Supabase database indexes
- Supabase database functions and `search_path`
- Web.dev Core Web Vitals
- Web.dev LCP optimization
- Web.dev INP optimization
- Chrome Lighthouse performance audits

Useful official links:

- Next.js Image Optimization: https://nextjs.org/docs/app/getting-started/images
- Next.js Caching: https://nextjs.org/docs/app/building-your-application/caching
- Next.js Lazy Loading: https://nextjs.org/docs/app/guides/lazy-loading
- Next.js Package Bundling: https://nextjs.org/docs/app/guides/package-bundling
- Supabase Advisors: https://supabase.com/docs/guides/database/database-advisors
- Supabase RLS Performance: https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations
- Supabase Query Optimization: https://supabase.com/docs/guides/database/query-optimization
- Web.dev LCP: https://web.dev/articles/optimize-lcp
- Core Web Vitals: https://web.dev/articles/vitals

## Supabase Advisor Warnings

From your screenshots, the visible Advisor warnings include:

- `Auth RLS Initialization Plan`
- `Function Search Path Mutable`
- `Multiple Permissive Policies`
- `Leaked Password Protection Disabled`
- account/project message: `Grace period started`

This document focuses on performance, but some security warnings also affect performance and production safety.

## Should Supabase Performance Warnings Be Resolved?

Yes, especially the database warnings that affect tables used by normal shoppers.

Supabase Advisor warnings are not cosmetic. They are based on database linting rules that detect patterns known to cause slower queries, weaker security, or unnecessary database work.

However, do not blindly run every generated fix on production. RLS policies control who can read or write customer data. A small mistake can either block real customers or expose private data.

The right approach is:

1. Reproduce current policies in staging.
2. Fix one group of warnings at a time.
3. Test customer, guest, admin, checkout, cart, wishlist, and reviews flows.
4. Deploy during a low-traffic window.
5. Re-run Supabase Advisor.

## Supabase Warning 1: Auth RLS Initialization Plan

This appears on `public.reviews` in the screenshots.

Meaning:

Some RLS policies call functions like this:

```sql
auth.uid() = user_id
```

Supabase recommends this shape instead:

```sql
(select auth.uid()) = user_id
```

Why:

The direct function call can be evaluated repeatedly while scanning rows. Wrapping it with `select` lets PostgreSQL cache the value once per statement. Supabase documents this as an RLS performance optimization.

Impact on Toycker:

- Important for `reviews`
- Important for `addresses`
- Important for `cart_items`
- Important for `orders`
- Important for `profiles`
- Important for `wishlist_items`
- Important for `reward_wallets` and `reward_transactions`

Priority:

High.

This is a good first fix because it is usually low-risk when the policy logic stays the same.

## Supabase Warning 2: Multiple Permissive Policies

This appears on tables like:

- `public.home_reviews`
- `public.addresses`
- `public.cart_items`

Meaning:

There are multiple permissive RLS policies for the same table, role, and action. PostgreSQL may need to evaluate multiple policies for the same query.

Example from your screenshot:

```txt
public.home_reviews has multiple permissive policies for role anon for action SELECT
```

Why this matters:

- It adds unnecessary RLS work.
- It makes the security model harder to understand.
- It can accidentally allow more access than intended.

Impact on Toycker:

High for `cart_items` and `addresses`, because these are customer-specific and used in important flows.

Medium for `home_reviews`, because it is public content but still affects homepage queries.

Priority:

High for customer tables. Medium for public marketing tables.

## Supabase Warning 3: Function Search Path Mutable

This appears on functions like:

- `public.update_trivara_sync_snapshots_updated_at`
- `public.search_products_multimodal`
- `public.update_trivara_order_bookings_updated_at`

Meaning:

The function does not explicitly set `search_path`.

This is mostly a security hardening warning, but it can also prevent unpredictable behavior.

Why this matters:

Database functions should not depend on whatever schema search path happens to be active. A function should either use fully qualified names like `public.products` or set a controlled `search_path`.

Impact on Toycker:

High for `search_products_multimodal`, because product search is a storefront feature.

Medium for trigger-style `updated_at` functions, unless they run very frequently.

Priority:

Medium-high.

Do not fix `search_products_multimodal` blindly. It may rely on extensions such as vector, trigram, or full-text search helpers. After setting `search_path`, test text search, image search, and product search carefully.

## Supabase Warning 4: Leaked Password Protection Disabled

This is an Auth security warning, not a page-speed warning.

Meaning:

Supabase is not currently blocking passwords that are known from public breach datasets.

Impact on Toycker:

High security value for a shopping site with customer accounts.

Performance impact:

Not a frontend performance improvement.

Priority:

Enable it if your Supabase plan supports it. It is production-readiness work.

## Which Should Be Done First: Supabase Warnings or Codebase Optimization?

For Toycker, the best order is:

1. Supabase RLS performance warnings on hot customer tables.
2. Product listing query optimization.
3. Image optimization and media delivery.
4. Global provider and JavaScript bundle reduction.
5. Search and visual search optimization.
6. Checkout/cart request reduction.
7. Admin dashboard optimization.

Why Supabase first:

- The database is shared by every page and flow.
- Slow RLS policies affect API response time.
- RLS fixes usually improve performance without changing UI.
- Security-sensitive tables should be clean before scaling traffic.

Why not only Supabase:

Fixing Supabase warnings will not automatically fix LCP, INP, image payload, JavaScript bundle size, or unnecessary client-side providers. Those need codebase work.

## Main Toycker Performance Findings

## 1. Image Optimization Is Disabled

In `next.config.js`:

```js
images: {
  unoptimized: true,
}
```

This disables Next.js image optimization.

Why this matters:

Next.js Image normally helps with:

- serving correctly sized images
- modern formats like WebP/AVIF
- lazy loading
- reducing layout shift
- faster LCP images

Toycker has many product images, banner images, review images, and local media assets. For an e-commerce site, image payload is usually one of the biggest performance factors.

What to do:

1. Confirm whether the CDN already performs resizing and WebP/AVIF conversion.
2. If the CDN does not optimize images, remove `unoptimized: true`.
3. Add correct `sizes` to responsive product, hero, collection, and gallery images.
4. Keep `priority` only for true above-the-fold images.
5. Convert large local PNG assets to WebP/AVIF where possible.

Files to inspect first:

- `next.config.js`
- `src/modules/home/components/hero/index.tsx`
- `src/modules/products/components/image-gallery/index.tsx`
- `src/modules/products/components/product-preview/index.tsx`
- `src/modules/home/components/exclusive-collections/index.tsx`

Priority:

High.

Expected benefit:

Better LCP, lower bandwidth, faster product/category pages, better mobile performance.

## 2. Large Local Media Assets

Large files found in `public/assets`:

- several `exclusive-*.mp4` files around 1.7 MB to 2.8 MB each
- `about_page.png` around 2.1 MB
- `about-page.png` around 2.1 MB
- `slider_default.png` around 2.1 MB
- `gift-wrap.png` around 2.0 MB
- `pwa-post.png` around 1.8 MB

Why this matters:

Large images and videos slow down first load if they are loaded early or without lazy loading.

What to do:

1. Convert large PNGs to WebP/AVIF.
2. Use poster images for videos.
3. Lazy-load below-the-fold videos.
4. Do not preload all exclusive collection videos.
5. Ensure videos are muted, compressed, and loaded only when near viewport.

Priority:

High for home page and about page.

## 3. Too Much Global Client-Side Work

`src/app/providers.tsx` wraps every page with:

- `LayoutDataProvider`
- `ToastProvider`
- `CartStoreProvider`
- `ShippingPriceProvider`
- `CartSidebarProvider`
- `WishlistProvider`
- `ChatbotProvider`
- `PWAProvider`
- `ChatbotWidget`
- `PWAClientWrapper`

Why this matters:

These providers run on all public pages. Some trigger client-side network calls or localStorage work even when the user is just reading a static page.

Examples:

- `LayoutDataProvider` fetches `/api/storefront/layout-state` on mount with `no-store`.
- `WishlistProvider` calls Supabase auth on mount.
- `ChatbotProvider` refreshes user info on mount for non-admin pages.
- `CartStoreProvider` keeps optimistic cart state globally.

What to do:

1. Split providers by route group.
2. Keep only essential providers at root.
3. Mount chatbot only when launcher is visible or after idle time.
4. Do not fetch customer/cart state on pages where it is not needed immediately.
5. Consider moving cart/wishlist hydration closer to header or cart UI instead of all pages.

Priority:

High.

Expected benefit:

Better INP, less JavaScript, fewer initial network requests, faster static pages.

## 4. Product Listing Fetches Too Much Data

In `src/lib/data/products.ts`, `PRODUCT_SELECT` includes:

```sql
*
variants:product_variants(*)
options:product_options(*, values:product_option_values(*))
related_combinations:product_combinations(...)
```

This is used by listing functions.

Why this matters:

Product listing cards usually do not need full variants, options, related combinations, and nested related product data.

For catalog pages, this can create heavy API responses and expensive database joins.

What to do:

Create separate select shapes:

1. `PRODUCT_CARD_SELECT` for grids and rails.
2. `PRODUCT_DETAIL_SELECT` for product detail pages.
3. `PRODUCT_ADMIN_SELECT` for admin editing.

Example:

```ts
const PRODUCT_CARD_SELECT = `
  id,
  name,
  handle,
  thumbnail,
  image_url,
  price,
  compare_at_price,
  stock_count,
  status,
  created_at
`
```

Priority:

Very high.

Expected benefit:

Faster store, category, collection, home product rails, search results, and wishlist pages.

## 5. Price Filtering Is Done In Memory

In `listPaginatedProducts`, when a price filter is active:

```ts
const { data, count, error } = needsClientSideFiltering
  ? await query
  : await query.range(offset, offset + limit - 1)
```

Then products are filtered and paginated in JavaScript.

Why this matters:

If Toycker has 100 products, this may be acceptable. If it has 5,000 products, this becomes expensive and slow.

What to do:

Move price filtering into the database.

Options:

1. Store computed `min_variant_price` on `products`.
2. Create a view or materialized view for searchable/listable products.
3. Create an RPC for catalog filtering and sorting.
4. Index the computed price column.

Priority:

Very high.

Expected benefit:

Better store/category/collection page performance as catalog grows.

## 6. Product Pages Are Generated For Every Product At Build Time

`src/app/(main)/products/[handle]/page.tsx` uses:

```ts
export async function generateStaticParams() {
  const { response: { products } } = await listProducts()
  return products.map((product) => ({ handle: product.handle }))
}
```

Build output showed `357` static pages generated.

Why this matters:

This is fine now, but build time will grow as the catalog grows. Also, `listProducts()` currently fetches a heavy product select.

What to do:

1. Make `generateStaticParams()` fetch only `handle`.
2. Consider generating only top-selling or recently updated products.
3. Let long-tail products generate on demand with ISR.

Priority:

Medium now. High when catalog grows.

Expected benefit:

Faster builds and deployments.

## 7. Storefront API Routes Are Force Dynamic

Examples:

- `/api/storefront/products`
- `/api/storefront/layout-state`
- `/api/storefront/shipping-options`
- `/api/cart`
- `/api/cart/restore`

Some of these should be dynamic. Cart and customer state must be dynamic.

But product listing can often benefit from smarter caching, especially for common queries like:

- first store page
- featured sort
- category pages
- collection pages
- home rails

What to do:

1. Keep cart, checkout, auth, payment, and customer routes dynamic.
2. Cache public product listing responses by query where safe.
3. Use tag-based invalidation when products/categories/collections change.
4. Keep personalized fields out of public cached product responses.

Priority:

Medium-high.

## 8. Homepage Is Good But Can Be Better

Good existing choices:

- Some below-the-fold sections use dynamic imports.
- Some sections use `Suspense`.
- Home banners and exclusive collections are cached.
- Product sections stream independently.

Remaining issues:

- Homepage still depends on `listHomeReviewsStorefront()`.
- Global providers still run on the homepage.
- Large videos/images may affect load.
- Root route `/` is dynamic in build output.

What to do:

1. Make review data cached with tags if it is public.
2. Lazy-load review media and exclusive videos.
3. Keep hero image optimized and prioritized.
4. Reduce global provider work on the homepage.

Priority:

High because homepage is usually the highest-traffic page.

## 9. Search Needs Database-Level Attention

Search uses:

- `search_products_multimodal`
- category `ilike`
- collection `ilike`
- image search endpoint
- local ML embedding code

Potential issues:

- `ilike('%query%')` needs trigram indexes to scale.
- `search_products_multimodal` is flagged for mutable `search_path`.
- Image search can be CPU-heavy because it processes uploads and generates embeddings.
- The image search endpoint has many `console.log` statements.

What to do:

1. Fix `search_products_multimodal` `search_path`.
2. Confirm indexes for product name, category name, collection title, and vector search.
3. Rate-limit image search.
4. Move expensive embedding work off the request path if traffic grows.
5. Remove verbose production logs from image search routes.

Priority:

High if users actively use search.

## 10. Cart And Checkout Need Request Discipline

Cart and checkout are allowed to be dynamic. They contain user-specific state.

Still, the goal should be fewer round trips and smaller responses.

Observed behavior:

- `LayoutDataProvider` fetches layout state globally.
- Cart reload uses `/api/cart?ts=${Date.now()}` with `no-store`.
- Shipping options have a small in-memory 15-second cache.
- Cart operations call server actions and then often reload from server.

What to do:

1. Keep cart state optimistic.
2. Batch cart updates when possible.
3. Avoid reloading full cart after every small operation if the mutation already returns the updated cart.
4. Load shipping options only in cart/checkout flows, not globally.
5. Ensure indexes exist for `carts.user_id`, `cart_items.cart_id`, `orders.cart_id`, `orders.user_id`, and `addresses.user_id`.

Priority:

High because cart and checkout directly affect revenue.

## 11. JavaScript Bundle Weight Should Be Audited

The project uses several heavy packages:

- `swiper`
- `recharts`
- `@tiptap/react`
- `@stripe/react-stripe-js`
- `@xenova/transformers`
- `papaparse`
- `react-icons`
- `lodash`

Some are admin-only or feature-specific and should not load on normal storefront pages.

Good existing choice:

- `next.config.js` already uses `optimizePackageImports`.
- PWA registration is dynamically imported.

What to do:

1. Run `pnpm analyze`.
2. Confirm admin-only packages stay out of storefront bundles.
3. Dynamically import `swiper` gallery if possible.
4. Keep `recharts`, `tiptap`, and CSV tools admin-only.
5. Replace `lodash/isEqual` with the local native helper where reasonable.
6. Replace `react-icons` share icons with smaller icon imports or existing icon system.

Priority:

Medium-high.

## 12. Production Console Logging Should Be Reduced

There are many `console.log` statements in routes and client components, including:

- auth callback
- payment callbacks
- image search
- product add to cart
- PWA prompt
- Supabase server cookie handling
- embedding/model loading

`next.config.js` removes console logs in production compilation, but server/runtime logs and some build/runtime paths can still create noise or overhead depending on how they are bundled and executed.

What to do:

1. Keep `console.error` and meaningful `console.warn`.
2. Replace debug logs with structured logging guarded by environment flags.
3. Remove sensitive payment/auth debug output.

Priority:

Medium.

## 13. Admin Pages Are Dynamic And Heavy

Admin pages use:

- product tables
- inventory tables
- charts
- rich text editor
- CSV import/export
- media manager
- global search

This is acceptable because admin is not public SEO traffic, but slow admin pages hurt operations.

What to do:

1. Paginate all admin tables.
2. Avoid `select("*")` on admin list pages.
3. Lazy-load charts and rich text editor.
4. Cache dashboard summary counts briefly.
5. Add indexes for admin filters and sorting columns.

Priority:

Medium.

## Recommended Execution Plan

## Phase 1: Production Safety And Database Foundation

Do first:

1. Resolve Supabase `Grace period started`.
2. Fix `Auth RLS Initialization Plan` warnings on customer and review tables.
3. Fix `Multiple Permissive Policies` on `addresses`, `cart_items`, `reviews`, `home_reviews`, and other hot tables.
4. Fix `search_path` warnings for functions, especially `search_products_multimodal`.
5. Enable leaked password protection if the plan supports it.

Validation:

- Guest can browse products.
- Guest can search.
- Customer can log in.
- Customer can add to cart.
- Customer can check out.
- Customer can view addresses and orders.
- Admin can manage products, categories, collections, reviews, orders, and home settings.
- Supabase Advisor warnings reduce after rerun.

## Phase 2: Product Listing And Query Shape

Do next:

1. Split product select shapes.
2. Stop using the full product detail select for product grids.
3. Move price filtering into SQL or a database view.
4. Add indexes for storefront filters and RLS columns.
5. Cache public listing queries where safe.

Validation:

- Store page loads same products as before.
- Category and collection filters still work.
- Price filters still work.
- Product card prices are correct.
- Product detail page still has variants/options/related products.

## Phase 3: Images, Video, And LCP

Do next:

1. Re-enable Next image optimization or confirm CDN-level optimization.
2. Add proper `sizes`.
3. Convert large PNG assets.
4. Lazy-load below-the-fold videos.
5. Ensure hero image is the only likely priority image on homepage.

Validation:

- Lighthouse mobile LCP improves.
- Product images remain sharp.
- No layout shift.
- CDN returns modern formats where possible.

## Phase 4: Reduce Global Client Work

Do next:

1. Split root providers.
2. Lazy-load chatbot.
3. Delay wishlist/customer/cart hydration where not immediately needed.
4. Avoid global shipping option fetching.
5. Keep static pages static where possible.

Validation:

- Fewer initial requests in Chrome DevTools.
- Less JavaScript on homepage and static pages.
- Header/cart/wishlist still update correctly.

## Phase 5: Bundle And Feature-Level Optimization

Do next:

1. Run bundle analyzer.
2. Keep admin packages out of storefront bundles.
3. Dynamically import heavy optional UI.
4. Optimize search/image-search CPU path.
5. Add production performance monitoring dashboards.

Validation:

- Smaller client bundles.
- Better INP.
- Search remains correct.
- Admin tools still work.

## Final Priority List

Highest priority:

1. Supabase RLS performance warnings on customer/hot tables.
2. Product listing query shape.
3. Price filtering in database instead of memory.
4. Image optimization and large media cleanup.
5. Reduce global provider/network work.

Medium priority:

1. Search function hardening and indexing.
2. Bundle analyzer cleanup.
3. Admin page pagination and dynamic imports.
4. Console/debug logging cleanup.

Lower priority:

1. Build-time optimization for static product pages.
2. More granular cache invalidation.
3. Advanced edge/CDN tuning.

## Plain English Conclusion

Toycker does not need one big rewrite. It needs focused production hardening.

Start with Supabase Advisor warnings because they affect database speed and safety for the whole site. Then optimize the storefront code where the biggest repeated cost exists: product listing data, images, global client providers, cart/checkout requests, and search.

Fixing Supabase warnings will improve database/API performance, especially as rows increase. It will not automatically fix frontend performance. For the full site to feel faster, Toycker needs both database optimization and frontend optimization.

