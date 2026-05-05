# Remaining Risk: Cart, Checkout, And Stale Cart Data

## Classification

`both (codebase + Supabase)`

Code changes can reduce how often full cart data is loaded. Supabase-only maintenance can clean up old abandoned carts if they start growing.

## Why This Risk Remains

Cart and checkout pages must load full cart details. That is expected because users need item details, prices, shipping, discounts, and payment state.

In `src/lib/data/cart.ts`, `retrieveCart()` still loads:

- cart row
- cart items
- product data
- variant data
- promotion data

That is correct for cart and checkout, but it is heavier than the global layout cart summary.

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

## What Can Still Increase Egress

- Users repeatedly opening cart or checkout.
- Cart drawer fetching full cart too often.
- Abandoned carts staying forever and growing the table.
- Checkout refreshes during payment attempts.
- Bots or test scripts repeatedly creating carts.

## Recommended Action

Do not change checkout behavior unless monitoring shows cart endpoints are high.

If this becomes a problem:

Code-only changes:

1. Make sure the cart drawer fetches full cart only when opened.
2. Avoid repeated full-cart refreshes after every small UI state change.
3. Keep cart mutations returning only needed fields when possible.
4. Keep layout state summary-only.

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

## References

- Supabase egress optimization recommends reducing fields, rows, and repeated calls: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Supabase RLS performance recommends filters and indexes on user-owned data: https://supabase.com/docs/guides/database/postgres/row-level-security
