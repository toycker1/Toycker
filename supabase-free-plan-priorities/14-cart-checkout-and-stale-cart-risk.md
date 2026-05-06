# Remaining Risk: Cart, Checkout, And Stale Cart Data

## Classification

`both (codebase + Supabase)`

Code changes can reduce how often full cart data is loaded. Supabase-only maintenance can clean up old abandoned carts if they start growing.

## Status

`Completed for code-side cart payload reduction on 06 May 2026`

The customer-facing full cart response has been optimized and manually verified. Supabase-only abandoned cart cleanup was not implemented because it is a separate maintenance action and should only run after weekly monitoring, backup, and explicit approval.

## Why This Risk Remains

Cart and checkout pages must load full cart details. That is expected because users need item details, prices, shipping, discounts, and payment state.

In `src/lib/data/cart.ts`, `retrieveCart()` still loads the full cart workflow data that cart and checkout need:

- cart row
- cart items
- lightweight product summary data
- lightweight variant summary data
- lightweight promotion data

That is correct for cart and checkout, but it remains intentionally heavier than the global layout cart summary.

Before this implementation, the cart query used wildcard nested selects:

```txt
product:products(*)
variant:product_variants(*)
promotion:promotions(*)
```

That caused `/api/cart` to return heavy product fields such as descriptions, SEO metadata, video URLs, search vectors, and image embeddings. Those fields are no longer returned by the cart response.

## Current Evidence

Related files:

- `src/lib/data/cart.ts`
- `src/lib/data/layout-state.ts`
- `src/app/api/cart/route.ts`
- `src/app/(main)/cart/page.tsx`
- `src/app/(checkout)/checkout/page.tsx`
- `src/app/api/storefront/shipping-options/route.ts`
- `src/lib/actions/complete-checkout.ts`

Production evidence:

- `carts`: about `508` rows
- `cart_items`: about `443` rows
- indexes exist on:
  - `cart_items(cart_id)`
- `cart_items(product_id)`
- `carts(user_id)`

## Git History To Check First

Before changing cart or checkout behavior, inspect Git history for the completed layout/cart work:

```powershell
git log --oneline -- src/lib/data/cart.ts src/lib/data/layout-state.ts src/app/api/storefront/layout-state/route.ts src/app/api/storefront/shipping-options/route.ts
git log --oneline -- supabase-free-plan-priorities/04-layout-state-payload-reduction.md supabase-free-plan-priorities/05-cart-summary-vs-full-cart.md
git show --stat <relevant-commit>
```

This is important because priorities 4 and 5 already separated lightweight cart summary from full cart detail. Do not reintroduce full cart loading into global layout.

## What Is Already Good

- Global layout no longer loads full cart.
- Layout state fetches only cart summary fields.
- Full cart retrieval remains limited to cart, checkout, cart drawer/action flows.
- Shipping options now use lightweight cart summary behavior where possible.
- `/api/cart` no longer returns full product rows for each cart item.
- Cart item products now return only lightweight fields needed by cart and checkout UI:
  - `id`
  - `handle`
  - `name`
  - `price`
  - `currency_code`
  - `image_url`
  - `thumbnail`
  - `images`
  - `metadata`
  - `status`
- Cart item variants now return only lightweight fields needed by price, title, SKU, and inventory display.

## Completed Implementation

Files changed:

- `src/lib/data/cart.ts`
- `src/lib/util/cart-calculations.ts`
- `src/lib/supabase/types/index.ts`

Implemented changes:

1. Replaced `product:products(*)` with an explicit lightweight product select.
2. Replaced `variant:product_variants(*)` with an explicit lightweight variant select.
3. Replaced `promotion:promotions(*)` with an explicit lightweight promotion select.
4. Added cart-specific `CartProductSummary` and `CartVariantSummary` TypeScript types.
5. Updated `mapCartItems()` to work with the lightweight cart product and variant rows.
6. Removed `any` casts from the touched cart data path.

The optimized `/api/cart` product object no longer includes:

- `description`
- `short_description`
- `seo_title`
- `seo_description`
- `seo_metadata`
- `video_url`
- `search_vector`
- `image_embedding`
- `category_id`
- `collection_id`
- `created_at`
- `updated_at`

The `images` array still remains in cart product data because the cart, cart drawer, and checkout thumbnail UI can use product images. This is acceptable for now because the largest payload problems were the removed fields. If future monitoring shows `/api/cart` is still a top egress source, the next simple code-only improvement is to return only `image_url` and `thumbnail` for cart products and stop returning the full `images` array.

No Supabase migration was required. No new tables were created. No existing tables were changed. No RLS policies were added or updated.

## What Can Still Increase Egress

- Users repeatedly opening cart or checkout.
- Cart drawer fetching full cart too often.
- Abandoned carts staying forever and growing the table.
- Checkout refreshes during payment attempts.
- Bots or test scripts repeatedly creating carts.
- The remaining `images` array can still add small payload weight for products with many image URLs.

## Recommended Action

Do not change checkout behavior unless monitoring shows cart endpoints are high.

If this becomes a problem:

Code-only changes:

1. Make sure the cart drawer fetches full cart only when opened.
2. Avoid repeated full-cart refreshes after every small UI state change.
3. Keep cart mutations returning only needed fields when possible.
4. Keep layout state summary-only.
5. If monitoring proves `/api/cart` is still too large, remove the `images` array from the cart product select and rely only on `image_url` or `thumbnail`.

Supabase-only changes:

1. Review abandoned cart volume weekly.
2. If abandoned carts grow quickly, create a planned cleanup policy.
3. Cleanup should target only old anonymous carts with no completed order.
4. Take a backup before any cleanup.

Both code + Supabase changes:

1. If cleanup becomes recurring, add a safe scheduled cleanup function or cron job.
2. Add code-level safeguards so checkout never depends on old abandoned carts.

## Implementation Trigger

Only implement this file if one of these is true:

- Supabase Usage or Logs shows `/api/cart`, `/cart`, `/checkout`, or shipping options are high-volume paths.
- `carts` and `cart_items` keep growing quickly because of abandoned anonymous carts.
- Full cart data is being fetched on pages that only need item count.
- Checkout refreshes repeatedly call full cart queries.

If the problem is only normal users checking out, do not reduce required checkout data.

## Simple Code-Only Plan If Full Cart Is Called Too Often

1. Inspect `src/lib/data/cart.ts`.
2. Search for `retrieveCart(` callers.
3. Classify each caller:
   - needs full cart
   - needs only summary
   - should not fetch cart at all
4. Keep full cart for:
   - `/cart`
   - `/checkout`
   - payment callback validation
   - cart mutations that recalculate totals
5. Use summary for:
   - header count
   - layout state
   - lightweight shipping option checks if full item detail is not needed
6. Avoid changing order total logic.
7. Avoid changing payment callback logic unless there is a confirmed bug.

## Simple Supabase-Only Plan If Old Carts Grow

Do this only after backup and read-only dry-run counts.

Safe dry-run checks:

```sql
select count(*)
from public.carts
where created_at < now() - interval '30 days'
  and user_id is null;
```

Then verify those carts are not linked to orders:

```sql
select count(*)
from public.carts c
where c.created_at < now() - interval '30 days'
  and c.user_id is null
  and not exists (
    select 1
    from public.orders o
    where o.metadata->>'cart_id' = c.id::text
  );
```

Do not run delete queries from this file automatically. A human should approve cleanup separately.

## How To Avoid Breaking Existing Functionality

- Never delete recent carts.
- Never delete carts linked to orders.
- Never delete carts that may be in payment flow.
- Never remove full cart data from checkout totals.
- Never assume anonymous cart means unused cart.
- Keep cart ownership checks intact.

## What Not To Do

- Do not reduce cart detail on checkout if it breaks order totals.
- Do not delete recent carts.
- Do not delete carts that are linked to orders or payment attempts.
- Do not run production cleanup without a backup and a dry-run count.

## Testing If Changed Later

1. Add product to cart as guest.
2. Open cart drawer.
3. Open `/cart`.
4. Change quantity.
5. Remove item.
6. Go to `/checkout`.
7. Select address and shipping.
8. Confirm order summary remains correct.
9. Log in and confirm cart still belongs to the correct user.
10. Confirm layout-state still returns only cart summary fields.

## Manual Verification On 06 May 2026

The user manually tested the cart page and direct `/api/cart` JSON response.

Verified working:

1. `/cart` loads correctly.
2. Cart item title, image, price, quantity, and totals display correctly.
3. Club discount and payment discount totals remain correct.
4. Free shipping threshold behavior remains correct.
5. Direct `/api/cart` response returns lightweight product objects.
6. Direct `/api/cart` response no longer includes heavy product fields such as `description`, `seo_metadata`, `video_url`, `search_vector`, or `image_embedding`.

Quality checks from implementation:

- `pnpm.cmd build`: passed.
- `git diff --check`: passed.
- `pnpm.cmd exec tsc --noEmit`: blocked only by the existing unrelated test issue in `tests/lib/actions/complete-checkout.test.ts`.
- `pnpm.cmd lint`: blocked by the existing repo lint script issue where `next lint` resolves `lint` as a project directory.

## References

- Supabase egress optimization recommends reducing fields, rows, and repeated calls: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Supabase RLS performance recommends filters and indexes on user-owned data: https://supabase.com/docs/guides/database/postgres/row-level-security
