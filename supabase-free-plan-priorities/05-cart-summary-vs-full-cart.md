# Priority 5: Cart Summary Vs Full Cart

## Status

Completed.

- Completed on: 05 May 2026
- Manual testing status: passed
- Implementation type: `code-only`
- Supabase migration required: `no`
- Supabase dashboard/config change required: `no`

## Classification

`code-only`

## Priority

Do this with or shortly after layout state payload reduction.

## Problem

Full cart retrieval is expensive because it includes cart items, product rows, variants, promotions, shipping options, settings, and pricing calculations. The global layout usually does not need all of that.

## Current Toycker Evidence

Implementation update:

- Count-only UI now uses the lightweight layout cart summary as a fallback when full cart details are not loaded yet.
- The desktop/header cart badge and mobile cart badge can show `item_count` without forcing a full cart payload.
- `/api/storefront/shipping-options` now reads the lightweight cart summary instead of calling full `retrieveCart()`.
- Full cart retrieval remains in place for cart drawer details, cart page, checkout page, cart mutations, payment, promotions, rewards, and order creation.
- Manual testing confirmed the layout-state response stays lightweight and checkout shipping options still return correctly.

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

- Header/cart badge uses summary data only. Passed on 05 May 2026.
- Mobile cart badge uses summary data as fallback. Passed on 05 May 2026.
- Cart drawer either loads full cart on open or receives full data after explicit refresh. Passed on 05 May 2026.
- Cart page and checkout page still use full cart. Passed on 05 May 2026.
- Add/remove/update cart operations still revalidate or refresh the correct data. Passed on 05 May 2026.
- Shipping options endpoint still returns active shipping options. Passed on 05 May 2026.

## Implementation Summary

Files changed:

- `src/modules/layout/components/mobile-nav/index.tsx`
- `src/modules/layout/components/cart-badge/index.tsx`
- `src/app/api/storefront/shipping-options/route.ts`

The implementation keeps two separate read paths:

```ts
LayoutCartSummary
```

for global count-only UI, and:

```ts
Cart
```

for full cart, checkout, pricing, payment, and order behavior.

Manual browser testing showed `/api/storefront/layout-state` returns either:

```json
{
  "customer": {
    "id": "...",
    "first_name": "Rudra",
    "is_club_member": true
  },
  "cart": null
}
```

or the lightweight cart summary:

```json
{
  "customer": {
    "id": "...",
    "first_name": "Rudra",
    "is_club_member": true
  },
  "cart": {
    "id": "...",
    "user_id": "...",
    "region_id": null,
    "currency_code": "inr",
    "updated_at": "...",
    "item_count": 1
  }
}
```

The response does not include full cart `items`, products, variants, promotions, shipping methods, addresses, metadata, or payment collection data.

Manual console testing also confirmed:

```js
fetch("/api/storefront/shipping-options")
  .then((res) => res.json())
  .then(console.log)
```

returns active shipping options, including `Standard Shipping`.

## Quality Check Status

- Focused tests: passed with `pnpm.cmd test tests\lib\data\layout-state.test.ts`
- Build: passed with `pnpm.cmd build`
- TypeScript: blocked by existing unrelated `tests/lib/actions/complete-checkout.test.ts` error
- Lint: blocked by existing `next lint` script issue

## References

- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase billing FAQ: https://supabase.com/docs/guides/platform/billing-faq
