# Priority 5: Cart, Checkout, Wishlist, Account, And Orders Performance Plan

Status: Implemented and manually verified
Change type: mostly code-only
Supabase migration required: No by default

Completed: 2026-05-12

## Implementation Summary

- Cart and account pages now parallelize safe server data loading.
- Checkout no longer loads Stripe-specific code unless a Stripe-like payment method is used.
- Wishlist uses the server-fetched wishlist IDs immediately and keeps recently viewed products limited.
- Account order history continues to use lightweight order summary data.
- No new Supabase migration was required.
- Manual cart, checkout, wishlist, account, order list, and order detail testing passed.

## Goal

Keep customer-specific flows fast without unsafe caching.

Cart, checkout, wishlist, account, and orders are user-specific. These pages should not use broad public caching. The correct optimization is smaller responses, fewer duplicate requests, optimistic UI, and lazy loading of non-critical sections.

## Pages Covered

- Cart: `/cart`
- Checkout: `/checkout`
- Wishlist: `/wishlist`
- Account dashboard: `/account`
- Account profile
- Account addresses
- Account wallet/rewards
- Account reviews
- Account orders
- Order detail
- Order confirmed page

## Current Good Work Already Done

Supabase priorities already handled many high-risk backend issues:

- Layout state payload reduction.
- Cart summary vs full cart.
- Cart and checkout stale cart risk.
- Auth request reduction.
- Private account/order/customer risk documentation.

Before implementation, check:

```bash
git log --oneline --grep="cart"
git log --oneline --grep="checkout"
git log --oneline --grep="auth"
git log --oneline -- src/lib/data/cart.ts src/app/api/cart src/modules/cart src/modules/checkout
```

## Cart Risks

Main files:

- `src/app/(main)/cart/page.tsx`
- `src/modules/cart/templates/index.tsx`
- `src/modules/cart/templates/items.tsx`
- `src/modules/cart/templates/summary.tsx`
- `src/modules/cart/context/cart-store-context.tsx`
- `src/app/api/cart/route.ts`
- `src/lib/data/cart.ts`

Risks:

- Full cart can still be heavier than layout summary.
- Repeated quantity changes can create repeated requests.
- Product object inside cart item can grow again if full product fields are added.
- Cart sidebar and cart page may both request state.

What to do:

- Keep cart item product payload limited to fields needed in cart.
- Keep quantity updates optimistic.
- Debounce rapid quantity changes if needed.
- Do not show checkout-only payment discount on cart page.
- Load shipping options only where needed.

## Checkout Risks

Main files:

- `src/app/(checkout)/checkout/page.tsx`
- `src/modules/checkout/templates/checkout-form/index.tsx`
- `src/modules/checkout/templates/checkout-summary/index.tsx`
- `src/modules/checkout/components/payment/index.tsx`
- `src/modules/checkout/components/shipping/index.tsx`
- `src/app/api/storefront/shipping-options/route.ts`

Risks:

- Checkout must stay correct, so avoid unsafe caching.
- Payment providers should not load heavy JS until payment step.
- Shipping options should not fetch globally.
- Address forms should not rerender the whole checkout unnecessarily.

What to do:

- Lazy-load payment provider components by step.
- Keep checkout summary product payload minimal.
- Cache shipping options briefly only when safe.
- Avoid extra cart reload after mutations if mutation result is enough.

## Wishlist Risks

Main files:

- `src/app/(main)/wishlist/page.tsx`
- `src/modules/wishlist/templates/wishlist-page.tsx`
- `src/modules/wishlist/components/wishlist-content.tsx`
- `src/modules/products/context/wishlist.tsx`
- `src/lib/data/wishlist.ts`

Risks:

- Wishlist provider can hydrate globally.
- Wishlist page can load full product objects.
- Wishlist count and product cards should not require full detail payload.

What to do:

- Keep wishlist count lightweight.
- Use card-shaped product data.
- Delay wishlist hydration where possible.
- Keep wishlist UI correct after add/remove.

## Account And Orders Risks

Main files:

- `src/app/(main)/account/@dashboard/page.tsx`
- `src/app/(main)/account/@dashboard/orders/page.tsx`
- `src/app/(main)/account/@dashboard/orders/details/[id]/page.tsx`
- `src/modules/account/components/order-overview/index.tsx`
- `src/modules/account/components/order-card/index.tsx`
- `src/modules/order/templates/order-details-template.tsx`

Risks:

- Order detail pages naturally include item/address/payment data.
- Order lists should not include every nested order detail.
- Customer reviews/media should lazy-load.

What to do:

- Use summary payload for order list.
- Use full payload only on order detail.
- Avoid loading all historical orders at once.
- Keep pagination or "load more" if order count grows.

## Manual Testing

Cart:

1. Add two products to cart.
2. Open `/cart`.
3. Change quantity.
4. Remove item.
5. Confirm totals are correct.
6. Confirm cart header badge updates.

Checkout:

1. Start checkout from cart.
2. Select/add address.
3. Select shipping.
4. Select online payment.
5. Confirm payment discount appears only after online payment selection.
6. Place test order if safe in development.

Wishlist:

1. Add product to wishlist.
2. Open `/wishlist`.
3. Remove product.
4. Confirm header badge updates.

Account/orders:

1. Login.
2. Open account dashboard.
3. Open order history.
4. Open order detail.
5. Confirm no private data appears for another user.

## Expected Result

- User-specific flows remain correct.
- No unsafe public caching is introduced.
- Cart and checkout responses stay smaller than old full payloads.
- Payment provider scripts do not hurt unrelated pages.
