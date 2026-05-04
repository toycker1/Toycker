# Priority 5: Cart Summary Vs Full Cart

## Classification

`code-only`

## Priority

Do this with or shortly after layout state payload reduction.

## Problem

Full cart retrieval is expensive because it includes cart items, product rows, variants, promotions, shipping options, settings, and pricing calculations. The global layout usually does not need all of that.

## Current Toycker Evidence

In `src/lib/data/cart.ts`, `retrieveCartRaw` fetches:

```ts
items:cart_items(
  *,
  product:products(*),
  variant:product_variants(*)
),
promotion:promotions(*)
```

It also loads additional data such as reward wallet, global settings, payment provider discount, and shipping options depending on cart state.

This is correct for cart/checkout, but heavy for a header badge.

## Recommended Fix

Create two cart read paths:

1. Lightweight cart summary for global layout/header.
2. Full cart detail for cart, checkout, order creation, and cart drawer when opened.

Cart summary should avoid:

- `product:products(*)`
- `variant:product_variants(*)`
- full promotion rows
- full shipping option calculations unless visible in the header

Recommended summary fields:

```ts
id,
region_id,
updated_at,
items:cart_items(id, quantity)
```

Then calculate `item_count` in application code.

## Expected Impact

- Smaller layout responses.
- Fewer nested database rows transferred.
- Better performance for users who browse without opening the cart.

## Risks / Notes

- Existing components may assume `cart.items` contains full mapped cart items.
- Introduce a distinct type/name, such as `CartSummary`, to avoid accidentally passing summary data into checkout logic.
- Full cart should remain the source of truth for pricing and checkout.

## Acceptance Checks

- Header/cart badge uses summary data only.
- Cart drawer either loads full cart on open or receives full data after explicit refresh.
- Cart page and checkout page still use full cart.
- Add/remove/update cart operations still revalidate or refresh the correct data.

## References

- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase billing FAQ: https://supabase.com/docs/guides/platform/billing-faq
