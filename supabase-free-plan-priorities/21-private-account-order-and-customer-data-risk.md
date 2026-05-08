# Remaining Risk: Private Account, Order, Review, And Customer Data

## Purpose

This file covers private customer/account routes that are not public storefront listing pages.

These routes are lower risk than public store pages because bots normally cannot access them, but they can still increase Supabase egress when real users repeatedly open account pages, order pages, reviews, wallet, or profile screens.

## Status

`Documented for future monitoring`

No immediate code change is required unless Supabase logs show these private routes are high egress sources.

## Classification

`code-only if needed`

No Supabase migration is expected for the first fix. A migration should only be considered later if query performance or indexes become a measured problem.

## Related Files

Likely areas:

- `src/lib/data/orders.ts`
- `src/lib/data/customer.ts`
- `src/lib/actions/reviews.ts`
- `src/lib/data/rewards.ts`
- `src/lib/data/club.ts`
- `src/app/(main)/account`
- `src/app/api/customer/route.ts`
- `src/app/api/cart/restore/route.ts`

## Current Code Observation

Some private routes still use wider selects, including full order rows.

Examples:

- `src/lib/data/orders.ts` uses `select("*")` for customer order list/detail/cancel checks.
- Customer profile/address flows fetch the fields needed for account and checkout behavior.
- Reviews and rewards fetch private user data that can be larger as usage grows.

This is not automatically wrong.

Orders and customer records are private workflow data. They often need address, payment, item, and metadata fields. The key is to avoid loading full rows on screens that only need a summary.

## Why This Was Not Optimized Earlier

The earlier priorities targeted the highest public egress risks first:

- product listing
- store pagination
- search
- layout state
- cart summary
- visual search
- admin export/import
- bots/prefetch

Private account pages usually have much lower traffic than public store pages. Optimizing them too early can create checkout/account bugs without meaningful egress reduction.

## Required Git History Check

Before changing private account/order data, inspect Git history:

```powershell
git log --oneline -- src/lib/data/orders.ts src/lib/data/customer.ts src/lib/actions/reviews.ts src/lib/data/rewards.ts src/lib/data/club.ts
git log --oneline -- src/lib/data/cart.ts src/lib/actions/complete-checkout.ts
git show --stat <recent-or-relevant-commit>
```

This is important because cart, checkout, payment discount, rewards, and order logic have already been adjusted. Do not break order totals or account ownership checks.

## What Can Increase Egress

- A user repeatedly opens `/account/orders`.
- A user repeatedly opens order detail pages.
- Account pages return full order rows when only summary fields are needed.
- Review pages load product/order/media details repeatedly.
- Rewards/wallet pages fetch full transaction rows when summary would be enough.
- Admin/customer support repeatedly opens the same customer/order records.

## When To Implement

Implement only if monitoring shows one of these:

- Supabase Logs Explorer shows account/order/review/reward routes as top paths.
- Database egress rises while public store/search/cart routes are not the cause.
- Query Performance shows `orders`, `reviews`, `reward_transactions`, or `profiles` returning too many large rows.

## Simple Implementation Plan If Needed

Use a summary/detail split.

1. Find the page or API route causing high egress.
2. Identify the exact fields the screen displays.
3. Create a summary select for list pages.
4. Keep full select only for detail pages that truly need it.
5. Keep ownership filters:
   - user id checks
   - RLS expectations
   - admin permission checks
6. Do not change payment, cancellation, refund, or checkout safety logic unless the issue is in that flow.

Example approach:

- Account order list should usually need:
  - `id`
  - `display_id`
  - `created_at`
  - `status`
  - `payment_status`
  - `fulfillment_status`
  - `total_amount`
  - `currency_code`
- Order detail can keep fuller data if the UI shows items, address, payment, tracking, and timeline.

## How To Avoid Breaking Existing Workflows

- Do not remove fields used by order detail pages.
- Do not remove fields used by cancellation checks.
- Do not remove fields used by payment callbacks.
- Do not remove address fields from checkout/account address pages.
- Do not remove reward fields from wallet calculations.
- Do not bypass user ownership filters.

## Manual Testing If Changed Later

1. Log in as a customer.
2. Open account profile.
3. Open addresses.
4. Open order list.
5. Open order detail.
6. Cancel a cancellable order if a safe test order exists.
7. Open reviews/account review page.
8. Open wallet/rewards page.
9. Confirm no private data from another user is visible.
10. Confirm Network responses do not include unnecessary large fields on list pages.

## Simple Senior Explanation

Private account and order pages can still return bigger data because they are real customer workflows. This is acceptable unless monitoring proves they are a top egress source. If that happens, the safe fix is to split list pages into smaller summary queries and keep full data only for detail pages.

