# Priority 9: Auth Request Reduction

## Classification

`code-only`

## Priority

Do this after the larger database payload work. Auth is not the main issue, but reducing repeated checks helps.

## Problem

Supabase Auth responses also count as outgoing data. Repeated session/user checks across layouts and components can add unnecessary request volume.

## Current Toycker Evidence

The screenshot showed hundreds of Auth requests in the recent usage window. Local code uses Supabase auth through server/client helpers, including:

- `src/lib/data/auth.ts`
- `src/lib/data/customer.ts`
- `src/lib/data/cart.ts`
- account/login flows
- client-side auth confirmation pages

Some repeated auth checks are expected, but public pages should not perform more auth work than needed.

## Recommended Fix

Code-only changes:

- Centralize session/customer resolution for server-rendered areas.
- Avoid calling Auth from multiple nested components when parent state is enough.
- Use middleware/JWT claim checks where already available instead of network user lookups for simple gating.
- Do not fetch customer profile/address data on public pages unless UI requires it.
- Keep secure server-side checks for checkout, account, and admin pages.

## Expected Impact

- Lower Auth request count.
- Slightly lower egress.
- Cleaner separation between public and authenticated data flows.

## Risks / Notes

- Do not replace secure authorization checks with client-only state.
- Admin and account pages must still verify the user server-side.
- Checkout must still protect customer/cart ownership.

## Acceptance Checks

- Login/logout still works.
- Account pages still require authentication.
- Admin pages still require authentication/authorization.
- Public pages render without unnecessary customer/profile queries.
- Auth request count trends down during anonymous browsing.

## References

- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase billing FAQ: https://supabase.com/docs/guides/platform/billing-faq
