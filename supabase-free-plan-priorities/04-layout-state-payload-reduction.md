# Priority 4: Layout State Payload Reduction

## Classification

`code-only`

## Priority

Do this after product listing query and pagination work. It is a high-value code-only improvement.

## Problem

The global layout fetches cart and customer state with no cache. If this happens on every page load or navigation, Supabase may repeatedly send full cart/customer data even when the current page does not need it.

## Current Toycker Evidence

In `src/modules/layout/context/layout-data-context.tsx`:

```ts
fetch("/api/storefront/layout-state", {
  cache: "no-store",
  signal,
})
```

In `src/app/api/storefront/layout-state/route.ts`:

```ts
const [customer, cart] = await Promise.all([retrieveCustomer(), retrieveCart()])
```

This means a layout state refresh can trigger both customer and cart retrieval.

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

- Anonymous homepage visit does not perform unnecessary full customer/profile queries.
- Header cart badge still shows correct item count.
- Add-to-cart updates global cart state correctly.
- Account/login state still renders correctly.
- Cart and checkout pages still load full cart details.

## References

- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
