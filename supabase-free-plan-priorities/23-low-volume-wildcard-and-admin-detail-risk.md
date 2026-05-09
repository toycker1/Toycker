# Remaining Risk: Low-Volume Wildcard Queries And Admin Detail Pages

## Purpose

This file covers remaining `select("*")` or broad selects that are not currently the main egress risk because they are used in low-volume, private, admin, callback, or small-table workflows.

The goal is to document them so future AI agents do not repeatedly create new risk files for the same pattern.

## Status

`Completed for measured cart, checkout, shipping, rewards, and gift-wrap order-source-of-truth issues on 09 May 2026`

The measured user-facing issues were implemented and verified. Remaining broad admin/detail/callback/small-table responses are still documented for future monitoring and should not be optimized without evidence that one of those paths is a top egress source.

## Classification

`code-only if measured; Supabase migration only for measured checkout correctness`

No Supabase migration is expected for normal broad-select cleanup. A migration should only be considered if database query performance, indexes, schema shape, or checkout correctness become a measured problem.

For this completed work, one Supabase migration was required because checkout order creation depends on the database RPC `public.create_order_with_payment`. The migration does not add tables or indexes. It replaces the RPC so gift wrap is billed only from actual `gift_wrap_line` cart items, preventing stale product metadata from resurrecting a removed gift-wrap charge.

Applied development migration:

```txt
supabase/migrations/20260509174500_use_gift_wrap_lines_as_order_source_of_truth.sql
```

## Related Files And Areas

Examples of areas that may still contain broad selects:

- `src/lib/data/admin.ts`
- `src/lib/data/cart.ts`
- `src/lib/data/orders.ts`
- `src/lib/data/rewards.ts`
- `src/lib/data/promotions.ts`
- `src/lib/data/club.ts`
- `src/lib/data/variants.ts`
- `src/app/api/payu/callback/route.ts`
- `src/app/api/easebuzz/callback/route.ts`
- `src/app/api/admin/migrate-medusa/route.ts`
- `src/app/api/admin/search/backfill/route.ts`

## Why Some Broad Selects Still Exist

Not every `select("*")` is equally dangerous.

A broad select is usually low risk when:

- it is admin-only
- it is used for one detail page
- it is used during payment callback validation
- it reads a small table
- it uses `head: true` for count only
- it is not public
- it is not called on every page load
- it is not called by bots

Earlier priorities targeted high-volume public paths first because they have the biggest egress impact.

## Important Difference

High risk:

```txt
Public product listing fetching products(*)
Public search returning descriptions/images/embeddings
Layout fetching full cart on every page
Bots triggering repeated dynamic Supabase reads
```

Lower risk:

```txt
Admin detail page fetching one full order
Payment callback fetching one order/cart for verification
Small settings table fetching all fields
Count query using head: true
Manual import/export route
```

## Required Git History Check

Before changing any broad select, inspect Git history:

```powershell
git log --oneline -- src/lib/data/admin.ts src/lib/data/cart.ts src/lib/data/orders.ts src/lib/data/rewards.ts src/lib/data/promotions.ts src/app/api
git log --oneline -- supabase-free-plan-priorities/16-admin-dashboard-export-risk.md supabase-free-plan-priorities/19-production-monitoring-and-alerting.md
git show --stat <recent-or-relevant-commit>
```

This is important because admin, export, cart, checkout, PayU, Easebuzz, and monitoring behavior have already been adjusted. Do not break payment or admin workflows for small theoretical savings.

## What Can Still Increase Egress

- Admin opens many detail pages repeatedly.
- Admin export/import is run often.
- Payment callback retries repeatedly.
- A small table grows large over time but still uses `select("*")`.
- A formerly private route becomes public.
- A script/backfill route is run against all products repeatedly.

These remaining broad responses are still part of Priority 23, but they are monitoring-only unless logs or Query Performance prove they are expensive. Their existence does not make this priority incomplete.

## When To Implement

Implement only when there is evidence:

- Supabase Logs Explorer shows the route as high volume.
- Query Performance shows many rows or large payload from that query.
- The table has grown enough that broad select is now expensive.
- The route is called by public traffic or bots.

## Simple Implementation Plan If Needed

1. Identify the exact route/query from logs.
2. Confirm whether it is public, private, admin, callback, or script-only.
3. List the fields the UI or workflow actually uses.
4. Replace `select("*")` with explicit fields.
5. Keep full data only where required for safety:
   - payment callback verification
   - order total calculation
   - admin detail page fields
   - migration/import validation
6. Run full manual testing for that workflow.

## Examples Of Safer Query Shapes

Admin list pages should use summary fields:

```txt
id
display_id
created_at
status
payment_status
fulfillment_status
total_amount
currency_code
```

Admin detail pages can use more fields if the screen displays them.

Payment callbacks should prioritize correctness over tiny payload savings.

Small count queries can keep:

```txt
select("*", { count: "exact", head: true })
```

because no row body is returned.

## What Not To Do

- Do not remove fields from payment callbacks unless fully verified.
- Do not remove fields from admin detail pages if the UI displays them.
- Do not change import/export behavior without testing CSV workflows.
- Do not optimize count-only `head: true` queries just because they contain `*`.
- Do not change script/backfill routes unless they are actually run in production.

## Manual Testing If Changed Later

Test only the workflow touched:

- Admin product list/detail.
- Admin order list/detail.
- Admin export/import.
- Payment callback flow.
- Rewards/club flow.
- Cart/checkout flow.
- Backfill route only in development unless production approval is given.

Minimum checks:

```powershell
pnpm.cmd build
git diff --check
```

Also run typecheck/lint and report known repo caveats if they still exist.

## Completed Work On 09 May 2026

Implemented and verified:

- Replaced measured cart, shipping, and rewards wildcard/helper responses with explicit lightweight fields.
- Kept cart, checkout, shipping, and rewards behavior unchanged from the customer side.
- Fixed duplicate gift-wrap service-line behavior by matching gift-wrap cart lines using `gift_wrap_line` and `gift_wrap_fee`.
- Fixed gift-wrap removal behavior so removing gift wrap also cleans stale product gift-wrap metadata.
- Fixed related product-line removal behavior so removing a gift-wrapped product removes its matching gift-wrap line when no matching wrapped product line remains.
- Updated admin order detail summary to derive gift-wrap amount from actual order gift-wrap item lines instead of stale order metadata.
- Applied `20260509174500_use_gift_wrap_lines_as_order_source_of_truth.sql` to Toycker Development and verified the remote RPC no longer uses the stale product metadata fallback.

Verification completed:

```txt
pnpm.cmd exec tsc --noEmit
pnpm.cmd build
git diff --check
```

Known repo caveat:

```txt
pnpm.cmd lint
```

still fails because `next lint` resolves `lint` as a project directory in the current repo setup.

Manual verification completed:

- Shipping options response was checked in the browser console and returned only lightweight shipping fields.
- Toycker Development migration history shows `20260509174500` applied.
- Remote `create_order_with_payment` function verification confirmed:
  - new `SUM(gift_wrap_fee * quantity)` logic exists
  - old `v_has_gift_wrap_line` fallback flag does not exist
  - stale product metadata fallback does not exist

## Simple Senior Explanation

Some broad selects still exist because they are in low-volume or safety-critical flows. They should not be changed just for appearance. If monitoring later proves one is expensive, replace it with explicit fields for that exact workflow only.

