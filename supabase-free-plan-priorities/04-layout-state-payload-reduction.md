# Priority 4: Layout State Payload Reduction

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

Do this after product listing query and pagination work. It is a high-value code-only improvement.

## Problem

The global layout fetches cart and customer state with no cache. If this happens on every page load or navigation, Supabase may repeatedly send full cart/customer data even when the current page does not need it.

## Current Toycker Evidence

Implementation update:

- `/api/storefront/layout-state` now uses lightweight layout-state helpers instead of full `retrieveCustomer()` and full `retrieveCart()`.
- Customer layout state returns only `id`, `first_name`, and `is_club_member`.
- Cart layout state returns only summary fields: `id`, `user_id`, `region_id`, `currency_code`, `updated_at`, and `item_count`.
- Full cart details still load from the existing full cart paths when the cart sidebar, cart page, checkout page, or cart actions need them.
- Manual browser testing confirmed the layout-state response stays small before and after adding a product to cart.

In `src/modules/layout/context/layout-data-context.tsx`:

```ts
fetch("/api/storefront/layout-state", {
  cache: "no-store",
  signal,
})
```

In `src/app/api/storefront/layout-state/route.ts`:

```ts
const { customer, cart } = await retrieveLayoutState()
```

This means a layout state refresh now returns only layout-safe summary data.

## Recommended Fix

Make the global layout state endpoint lightweight and conditional.

Code-only changes:

- If there is no cart cookie, do not call full cart retrieval.
- If there is no authenticated user, avoid customer profile/address queries.
- Return a minimal layout payload by default.
- Keep full cart/customer fetches for pages that need full detail, such as account, cart, and checkout.

Recommended minimal response:

```ts
{
  customer: null | {
    id: string
    first_name?: string
    is_club_member?: boolean
  },
  cart: null | {
    id: string
    region_id?: string
    item_count: number
    subtotal?: number
  }
}
```

Exact fields should be based on what the header/cart badge actually renders.

## Expected Impact

- Fewer Supabase queries for anonymous users.
- Smaller response payloads for all users.
- Lower repeated egress on normal page navigation.

## Risks / Notes

- Header, cart badge, mobile nav, account menu, and cart drawer may expect full cart/customer objects.
- Do not break checkout or cart pages; they can still call full data loaders.
- Keep refresh behavior after add-to-cart and login/logout.

## Acceptance Checks

- Anonymous/public layout state does not return full customer/profile/address data.
- Header cart badge still shows correct item count. Passed on 05 May 2026.
- Add-to-cart updates global cart state correctly. Passed on 05 May 2026.
- Account/login state still renders correctly with lightweight customer fields. Passed on 05 May 2026.
- Cart and checkout pages still load full cart details through existing full cart paths. Passed on 05 May 2026.

## Implementation Summary

Files changed:

- `src/lib/data/layout-state.ts`
- `src/lib/types/layout-state.ts`
- `src/app/api/storefront/layout-state/route.ts`
- `src/modules/layout/context/layout-data-context.tsx`
- `src/modules/cart/context/cart-store-context.tsx`
- `src/modules/layout/context/cart-sidebar-context.tsx`
- `src/modules/layout/components/header/index.tsx`
- `src/modules/shipping/components/free-shipping-price-nudge/index.tsx`
- `tests/lib/data/layout-state.test.ts`

The implementation keeps the API response shape as:

```ts
{
  customer: LayoutCustomer | null
  cart: LayoutCartSummary | null
}
```

But the `cart` value is now a summary, not the full cart object.

Manual screenshot verification showed:

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

The response did not include full cart items, products, variants, addresses, promotions, shipping methods, or payment collection data.

## Quality Check Status

- Focused tests: passed with `pnpm.cmd test tests\lib\data\layout-state.test.ts`
- TypeScript: blocked by existing unrelated `tests/lib/actions/complete-checkout.test.ts` error
- Lint: blocked by existing `next lint` script issue
- Build: production compile reached `Compiled successfully`, then timed out during the TypeScript phase

## References

- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
