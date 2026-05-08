# Remaining Risk: Low-Volume Wildcard Queries And Admin Detail Pages

## Purpose

This file covers remaining `select("*")` or broad selects that are not currently the main egress risk because they are used in low-volume, private, admin, callback, or small-table workflows.

The goal is to document them so future AI agents do not repeatedly create new risk files for the same pattern.

## Status

`Documented for future monitoring`

No immediate code change is required unless monitoring proves one of these paths is a top egress source.

## Classification

`code-only if measured`

No Supabase migration is expected for normal cleanup. A migration should only be considered if database query performance, indexes, or schema shape become a measured problem.

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

## Simple Senior Explanation

Some broad selects still exist because they are in low-volume or safety-critical flows. They should not be changed just for appearance. If monitoring later proves one is expensive, replace it with explicit fields for that exact workflow only.

