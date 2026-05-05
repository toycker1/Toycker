# Priority 9: Auth Request Reduction

## Classification

`code-only`

## Status

Completed and manually verified on 05 May 2026.

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

## Implementation Completed

No Supabase migration was required.

The implementation keeps secure server-side checks where they matter, but avoids unnecessary Auth requests during normal public browsing:

- `src/lib/data/auth.ts` now detects whether the request has a Supabase auth cookie before calling Supabase Auth.
- `getAuthUser()` now returns `null` immediately when no auth cookie exists, so anonymous public requests do not call `auth.getUser()`.
- Lightweight verified-claims helpers are available for places that only need the user id.
- `src/proxy.ts` now skips Supabase auth validation for anonymous public routes, while still redirecting anonymous `/checkout` requests to login.
- `src/lib/data/layout-state.ts` now uses the lightweight verified user id for layout customer and cart summary checks.
- `src/modules/products/context/wishlist.tsx` now uses existing layout customer state instead of running a separate browser-side `supabase.auth.getUser()` during page load.
- Public product listing templates no longer call full `retrieveCustomer()` just to compute an unused login flag.
- Full customer and cart retrieval remain in account, cart, checkout, order, wishlist actions, and secure update flows.

## Expected Impact

- Lower Auth request count.
- Slightly lower egress.
- Cleaner separation between public and authenticated data flows.

## Risks / Notes

- Do not replace secure authorization checks with client-only state.
- Admin and account pages must still verify the user server-side.
- Checkout must still protect customer/cart ownership.

## Acceptance Checks

- Passed: login/logout still works.
- Passed: account pages still require authentication.
- Passed: admin pages still require authentication/authorization.
- Passed: public pages render without unnecessary customer/profile queries.
- Passed: anonymous public store browsing works without unnecessary `auth/v1/user` requests.
- Passed: guest cart still works.
- Passed: guest wishlist action still redirects to login/account.
- Passed: logged-in wishlist count and wishlist add/remove still work.
- Passed: checkout still loads for logged-in users.
- Passed: logged-out checkout still redirects to login.

## Manual Verification Evidence

Manual testing was completed on 05 May 2026.

Verified behavior:

- Anonymous `/store` browsing works.
- Network testing confirmed unnecessary Auth user requests are removed during anonymous public browsing.
- `/api/storefront/layout-state` returns `customer: null` for anonymous users.
- Guest cart behavior still works.
- Guest wishlist action redirects to login/account.
- Logged-in `/store` still receives lightweight layout customer state.
- Logged-in wishlist count and wishlist add/remove still work.
- `/cart` still loads full cart data correctly.
- `/checkout` still loads for logged-in users.
- Logged-out `/checkout` redirects to login.
- `/account` still gates correctly.
- `/admin` still works for an authorized admin user.

## Quality Checks

- `pnpm.cmd build`: passed.
- `pnpm.cmd exec tsc --noEmit`: blocked by existing unrelated test error in `tests/lib/actions/complete-checkout.test.ts`.
- `pnpm.cmd lint`: blocked by the existing `next lint` project script issue.
- No new `any` usage was found in touched files.

## References

- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
- Supabase billing FAQ: https://supabase.com/docs/guides/platform/billing-faq
