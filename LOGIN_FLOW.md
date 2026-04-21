# Login Flow — WhatsApp OTP System

This document explains how the login system works, what was temporarily disabled, and exactly how to restore it.

---

## Overview

Toycker uses **WhatsApp OTP login only** — there is no email/password login. When a user enters their phone number, a 4-digit OTP is sent to their WhatsApp via [AiSensy](https://aisensy.com). Once verified, a Supabase session is created and the user is logged in.

---

## How the Login Flow Works (Step by Step)

### Step 1 — User visits `/login`

**File:** `src/app/(main)/login/page.tsx`

Reads `returnUrl` search param (e.g. `/checkout?step=address`) and renders `LoginTemplate` → `PhoneLogin` component.

---

### Step 2 — User enters phone number → `sendOtp()` server action

**File:** `src/lib/data/otp.ts` → `sendOtp()`

What happens inside:
1. Validates phone — must be a 10-digit Indian number starting with 6–9
2. Normalises to `91XXXXXXXXXX` format
3. Rate-limits — checks `otp_codes` table for a recent OTP within cooldown (default 60 seconds)
4. Generates a 4-digit OTP using `crypto.randomInt`
5. Hashes the OTP with HMAC-SHA256 using `OTP_HASH_SECRET` — **plaintext OTP is never stored**
6. Invalidates any previous unexpired OTPs for this phone
7. Inserts a new row into `otp_codes` with `code_hash`, `delivery_status: "pending"`
8. Calls `sendAiSensyAuthenticationOtp()` to deliver the OTP via WhatsApp
9. Updates `delivery_status` to `"sent"` on success or `"failed"` on error
10. Returns cooldown seconds to the client

**AiSensy integration file:** `src/lib/integrations/aisensy.ts`
POSTs to `https://backend.aisensy.com/campaign/t1/api/v2` with the phone and OTP as template parameters.

> **Note:** The hardcoded test phone `919265348797` always receives code `1234` and skips AiSensy delivery entirely.

---

### Step 3 — User enters OTP → `verifyOtp()` server action

**File:** `src/lib/data/otp.ts` → `verifyOtp()`

What happens inside:
1. Validates phone and code format
2. Fetches the latest non-expired, non-verified, successfully-sent OTP for this phone from `otp_codes`
3. Checks max attempts (default 3). If exceeded, marks OTP as consumed
4. Increments attempt counter
5. Compares the provided code against the stored hash using `crypto.timingSafeEqual`
6. On match — marks OTP as `verified` and `consumed`

**User account resolution (3 paths):**
- **Path A** — Profile found by phone number → use existing user
- **Path B** — No profile by phone, but found by synthetic email (`91XXXXXXXXXX@wa.toycker.store`) → use existing user
- **Path C** — No existing user → create a new Supabase auth user via `admin.createUser()` using the synthetic email and confirmed phone

7. Syncs the phone number to `auth.users` metadata and the `profiles` table
8. **Session creation:**
   - Generates a magic link token via `admin.generateLink({ type: "magiclink", email })`
   - Exchanges the `hashed_token` for a session via `serverClient.auth.verifyOtp({ token_hash, type: "magiclink" })`
   - This sets the auth cookies — user is now logged in
9. Claims any guest cart (from `toycker_cart_id` cookie) for the newly logged-in user
10. Revalidates caches
11. Redirects to `/admin` if admin, otherwise to `returnUrl` or `/account`

---

### Step 4 — Session is active

The Supabase session is stored in HTTP-only cookies managed by `@supabase/ssr`.

| Context | How session is read |
|---------|-------------------|
| Server Components / Actions | `getAuthUser()` in `src/lib/data/auth.ts` — calls `supabase.auth.getUser()`, deduplicated with `cache()` |
| Middleware | `supabase.auth.getClaims()` — local JWT validation, no network call |
| Client Components | `createClient()` from `src/lib/supabase/client.ts` |

---

### Step 5 — Checkout with a logged-in user

With an active session:
- Middleware (`src/proxy.ts`) allows `/checkout` through — user is authenticated
- Checkout page (`src/app/(checkout)/checkout/page.tsx`) — `retrieveCustomer()` returns the profile
- Billing form — phone is **locked** (read-only), pre-filled from WhatsApp login phone
- Saved addresses shown in a dropdown
- "Save address for future use" checkbox is visible
- Rewards redemption visible for club members
- `completeCheckout()` uses the regular Supabase client — RLS applies normally

---

## Database Tables Involved

| Table | Purpose |
|-------|---------|
| `otp_codes` | Stores hashed OTPs, delivery status, attempt counts, expiry |
| `auth.users` | Supabase built-in auth table — stores user identity |
| `profiles` | App-level user profile — synced from `auth.users` via trigger |

### `otp_codes` columns
- `phone` — normalised phone number (`91XXXXXXXXXX`)
- `code_hash` — HMAC-SHA256 of the OTP (plaintext never stored)
- `expires_at` — TTL (default 10 minutes)
- `verified` — true after correct OTP entry
- `consumed_at` — timestamp when OTP was used or max attempts exceeded
- `attempts` — number of wrong attempts
- `delivery_status` — `pending` → `sent` / `failed`
- `provider_message_id` — AiSensy message ID for tracking

### Synthetic emails
Because Supabase auth requires an email, phone-only users get a synthetic email: `91XXXXXXXXXX@wa.toycker.store`. These are hidden from all customer-facing UI via `isSyntheticWhatsAppEmail()` in `src/lib/util/customer-email.ts`.

---

## Environment Variables Required for Login

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin operations |
| `OTP_HASH_SECRET` | HMAC secret for hashing OTPs — must not change |
| `AISENSY_API_KEY` | AiSensy API key for WhatsApp delivery |
| `AISENSY_CAMPAIGN_NAME` | AiSensy campaign template name |
| `OTP_TTL_SECONDS` | OTP expiry in seconds (default: 600) |
| `OTP_RESEND_COOLDOWN_SECONDS` | Minimum gap between resends (default: 60) |
| `OTP_MAX_ATTEMPTS` | Max wrong attempts before OTP is consumed (default: 3) |
| `WHATSAPP_LOGIN_EMAIL_DOMAIN` | Synthetic email domain (default: `wa.toycker.store`) |

---

## Auth Route Guards (What Protects Each Page)

| Page / Route | Guard | Mechanism |
|-------------|-------|-----------|
| `/checkout` | Middleware (`src/proxy.ts`) + checkout page | Redirect to `/login` if no session |
| `/account` and sub-pages | Account layout (`src/app/(main)/account/layout.tsx`) | Renders `LoginTemplate` inline if no customer |
| `/admin` and all sub-pages | Admin layout (`src/app/admin/layout.tsx`) → `ensureAdmin()` | Redirects to `/login` if not admin |
| All admin server actions | `ensureAdmin()` called at the top of every action | Redirects if not admin |

---

## Key Files Reference

```
src/
  app/
    (main)/login/page.tsx                        — Login page route
  lib/
    data/
      otp.ts                                     — sendOtp() and verifyOtp() server actions
      auth.ts                                    — getAuthUser() — canonical session check
      customer.ts                                — retrieveCustomer(), signout()
      orders.ts                                  — retrieveOrder(), cancelUserOrder()
    integrations/
      aisensy.ts                                 — WhatsApp OTP delivery
    util/
      customer-email.ts                          — isSyntheticWhatsAppEmail()
    constants/
      phone-login-otp.ts                         — OTP length, regex, min/max values
  modules/
    account/
      components/phone-login/index.tsx           — Login form UI (phone input + OTP input)
      templates/login-template.tsx               — Login page wrapper
  proxy.ts                                       — Next.js middleware (session + checkout guard)
  app/
    api/auth/callback/route.ts                   — Supabase auth callback handler
    (checkout)/checkout/page.tsx                 — Checkout page (auth-gated)
    admin/layout.tsx                             — Admin layout (strict auth guard)
supabase/
  migrations/
    20260227_add_otp_codes_table.sql             — otp_codes table
    20260310193000_harden_otp_codes_for_aisensy.sql
    20260311143000_sync_profile_phone_from_auth_phone.sql
```
