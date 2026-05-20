# Easebuzz Partial Payment - PM Clarification Brief

**Project:** Toycker (online children's toy store)  
**Reviewed on:** 2026-05-20  
**Status:** Awaiting business and Easebuzz confirmation before development begins

---

## 1. Purpose

Toycker has been asked to support partial payment with Easebuzz, for example:

- Customer pays 20% advance online now.
- Customer pays the remaining 80% later.

This is not a small UI toggle in the current Toycker checkout. Before development starts, we need written confirmation on:

1. Business rules from the PM / business / finance team.
2. Technical support from Easebuzz for Toycker's merchant account.

Without these answers, the development work can easily be built in the wrong direction.

---

## 2. Current Toycker Codebase Findings

After reviewing the current payment and order flow, this is the real current state:

| Area | Current state |
| --- | --- |
| Easebuzz checkout | Integrated through `src/lib/data/cart.ts` using Easebuzz `/payment/initiateLink` and redirecting the customer to the Easebuzz hosted payment page. |
| Payment amount | Uses `cart.total` as the full payable amount. |
| Order creation | `completeCheckout()` creates an order before redirecting to Easebuzz. The order starts as `status = pending` and `payment_status = pending`. |
| Success callback | `src/app/api/easebuzz/callback/route.ts` verifies hash, checks the callback amount, marks the order `order_placed`, and sets `payment_status = captured`. |
| Amount validation | The callback currently requires Easebuzz callback `amount` to match `order.total_amount`. A smaller advance payment would be rejected as an amount mismatch. |
| Payment expiry cleanup | Existing stale Easebuzz pending orders are marked failed after the 15-minute payment window plus 1-minute buffer. |
| Partial payment state | No dedicated `partially_paid`, `advance_paid`, `balance_due`, or payment-leg tracking exists today. |
| Balance collection | No second payment flow exists for collecting the remaining amount. |
| Admin/customer display | Current screens understand full paid, pending, failed, cancelled, refunded, shipped, delivered, etc. They do not have a complete partial-payment lifecycle. |

**Conclusion:** Toycker currently supports full online payment through Easebuzz. It does not currently support a true two-step partial-payment order lifecycle.

---

## 3. Research Summary

Easebuzz public material shows that Payment Links support partial payment use cases. Easebuzz also has official developer documentation pages for Payment Gateway Initiate Payment API and Create/Update Partial Payment Link, but those pages are JavaScript-rendered and should be confirmed directly with Easebuzz support for merchant-account-specific behavior.

Useful references:

- Easebuzz Payment Links page: https://easebuzz.in/payment-links/
- Easebuzz guide mentioning partial payments for larger purchases: https://easebuzz.in/explainers/features-and-updates/create-and-share-payment-links/
- Easebuzz integration guide mentioning hosted pages, APIs, SDKs, sandbox testing, webhooks, and refunds: https://easebuzz.in/explainers/payments/easy-payment-gateway-integration-with-easebuzz/
- Easebuzz official Initiate Payment API page: https://docs.easebuzz.in/docs/payment-gateway/8ec545c331e6f-initiate-payment-api
- Easebuzz official Create/Update Partial Payment Link page: https://docs.easebuzz.in/docs/payment-gateway/4pqtopz3qd669-create-update-partial-payment-link
- Easebuzz official Laravel SDK README: https://github.com/easebuzz/paywitheasebuzz-laravel-lib
- Easebuzz official Python package: https://pypi.org/project/Easebuzz/

Practical takeaway:

- For a basic working prototype, the simplest likely path is Easebuzz Payment Links / Partial Payment Links, if enabled on Toycker's merchant account.
- A full in-site partial-payment checkout is possible, but it needs order, payment, refund, admin, customer, and finance changes.

---

## 4. Recommended Paths

### Path A - Easebuzz Partial Payment Links

This is the recommended first option for a basic working prototype.

How it works:

- PM/business creates or triggers a partial payment link from Easebuzz.
- Customer pays the advance amount on Easebuzz.
- Toycker records the order as advance paid / balance due only after a confirmed payment event or verified admin action.
- Balance can be collected later by another payment link, COD, bank transfer, or manual admin update, depending on the business decision.

Why this is preferred:

- Lower risk than changing checkout immediately.
- Uses Easebuzz's partial-payment-capable product.
- Easier to test with real business rules.
- Avoids over-engineering while the business process is still unclear.

Expected effort after all confirmations:

- If handled mostly from Easebuzz dashboard: 2-5 working days for documentation, admin process, and light Toycker updates if needed.
- If API-driven link creation is required: 1-2 weeks depending on Easebuzz API details, webhook support, and admin/customer display needs.

### Path B - Full In-Site Partial Payment Checkout

This means Toycker checkout itself lets the customer choose or pay an advance amount.

This needs code and database changes:

- Store advance amount, paid amount, balance amount, and due date.
- Track multiple payment transactions against one order.
- Allow one order to have more than one Easebuzz transaction.
- Update callback validation so the advance amount is expected and safe.
- Add admin views for advance paid, balance due, balance paid, overdue, refunded, and forfeited states.
- Add customer order detail messaging for advance paid and balance due.
- Decide how cancellation and refund work for advance-only orders.
- Decide GST invoice timing with finance.

Expected effort after all confirmations:

- 2-4 weeks minimum for a stable prototype, plus testing.

### Path C - Do Not Build

Use this path if Easebuzz confirms that partial payment is not enabled or not suitable for Toycker's merchant account.

Options:

- Keep full online payment only.
- Use COD for remaining balance manually.
- Ask Easebuzz to enable Payment Links / SmartBilling / partial payment.
- Evaluate another payment provider only if the business case is strong.

---

## 5. Business Questions for PM / Business / Finance

Development should not start until these are answered.

### 5.1 Advance Amount

- Is the advance a percentage, such as 20%, or a fixed amount, such as Rs. 500?
- Is the amount fixed by Toycker or chosen by the customer?
- Is there a minimum or maximum advance amount?

### 5.2 Product Eligibility

- Is partial payment available for all products?
- Is it only for selected products, expensive products, pre-orders, or bulk orders?
- Is there a minimum order value for partial payment?

### 5.3 Balance Collection

How will the remaining balance be collected?

- Payment link before dispatch
- COD on delivery
- Manual bank transfer
- Admin manually marks balance paid
- Other method approved by finance

### 5.4 Shipping Rule

- Should Toycker ship after advance payment?
- Or should Toycker ship only after full payment?

This is a finance and operations decision, not only a technical decision.

### 5.5 Balance Not Paid

If the customer pays the advance but never pays the balance:

- When should the order be cancelled?
- Is the advance refunded?
- Is the advance kept as a cancellation fee?
- Is it converted to store credit?

### 5.6 Cancellation and Refunds

If the customer cancels after paying only the advance:

- Full refund?
- Partial refund?
- No refund?
- Store credit?

If the customer cancels after full balance is paid:

- Should the existing full-payment cancellation flow continue?
- Are refund rules different for partial-payment orders?

### 5.7 Rewards, Coupons, and Club Discounts

- Are coupons applied to the full order amount or only the advance?
- Are reward points deducted on advance payment or after full payment?
- Are reward points earned on advance payment or only after full payment?
- Does club membership activation happen after advance payment or full payment?

### 5.8 GST and Invoice Timing

Finance must confirm:

- Is the GST invoice raised on advance payment?
- Is it raised only after full payment?
- Is a receipt needed for advance and invoice later?

### 5.9 Customer Communication

Define required SMS, email, or WhatsApp messages for:

- Advance payment link sent
- Advance payment successful
- Balance payment reminder
- Balance paid
- Balance overdue
- Order cancelled
- Refund processed

### 5.10 Admin Controls

Should admins be able to:

- Create/send balance payment links?
- Mark balance as paid manually?
- Adjust advance or balance amount?
- Cancel partial-payment orders?
- Refund advance?

### 5.11 Rollout

- Launch for all products or only selected products first?
- Should this be behind a feature flag?
- Who approves the first production test order?

---

## 6. Questions for Easebuzz Support

The PM or account owner should get written answers from Easebuzz.

1. Is partial payment enabled on Toycker's Easebuzz merchant account?
2. Which product should Toycker use: Payment Gateway partial payment, Payment Links, Partial Payment Links, SmartBilling, or another product?
3. Can Toycker create partial payment links through API, or only through the Easebuzz dashboard?
4. Can an advance payment and balance payment be linked to the same Toycker order ID?
5. What unique ID should Toycker send for reconciliation: order ID, transaction ID, reference ID, or UDF field?
6. Will Easebuzz send a separate callback/webhook for each payment leg?
7. What exact callback fields are sent for partial-payment links?
8. What status values should Toycker expect for partial payment, expired link, failed payment, and successful payment?
9. Does the standard SHA-512 hash formula apply to partial-payment callbacks?
10. Can Toycker query transaction status through API if a callback is missed?
11. Are refunds supported for partial payments?
12. Can Toycker refund only the advance amount?
13. What are the refund limits and settlement timelines?
14. Is MDR charged on each payment leg?
15. Does the advance settle immediately, or only after full payment?
16. Are there minimum/maximum partial payment amounts?
17. Are there product category or MCC restrictions?
18. Please share official documentation links for the exact recommended flow.

---

## 7. Minimum Answers Required Before Development

Development can start only after these are confirmed:

- [ ] Advance rule is finalized.
- [ ] Product eligibility is finalized.
- [ ] Balance collection method is finalized.
- [ ] Shipping rule is finalized.
- [ ] Balance-not-paid policy is finalized.
- [ ] Cancellation/refund policy is finalized.
- [ ] GST/invoice handling is approved by finance.
- [ ] Easebuzz confirms partial payment support for Toycker's account.
- [ ] Easebuzz confirms the recommended technical flow.
- [ ] Rollout plan is approved.

---

## 8. Ready-to-Send Email to Easebuzz

**To:** support@easebuzz.in  
**Cc:** [Development Team Email]  
**Subject:** Partial Payment Support Clarification for Toycker (Merchant ID: [YOUR_MID])

Hi Team,

We run Toycker, an online toy store, and currently use Easebuzz Payment Gateway for full online payments.

We want to offer partial payment to customers, for example 20% advance online and the remaining 80% later.

Before development starts, please confirm the following in writing for our merchant account:

1. Is partial payment enabled on our Easebuzz merchant account?
2. Which Easebuzz product should we use for this: Payment Gateway partial payment, Payment Links, Partial Payment Links, SmartBilling, or another product?
3. Can we create partial payment links through API, or only from the dashboard?
4. Can two transactions, advance and balance, be linked to the same Toycker order ID?
5. What identifier should we send for reconciliation: order ID, transaction ID, reference ID, or UDF field?
6. Will we receive a separate callback/webhook for each payment leg?
7. What exact callback fields and status values will be sent?
8. What happens when a partial payment link expires?
9. Does the standard SHA-512 hash verification apply to partial-payment callbacks?
10. Is there a transaction status API we should call if a callback is missed?
11. Are partial refunds supported?
12. Can we refund only the advance amount?
13. What are the refund rules, limits, and settlement timelines?
14. Is MDR charged separately on advance and balance payments?
15. Does the advance settle immediately, or only after full payment?
16. Are there minimum/maximum amount restrictions?
17. Are there product category or MCC restrictions for our account?
18. Please share official documentation links for the recommended flow.

Please share written confirmation so our development team can finalize the technical approach without rework.

Thanks,  
[PM Name]  
Toycker  
[Merchant ID / Registered Email]  
[Phone Number]

---

## 9. Development Notes After Confirmation

If Path A is confirmed:

- Keep the existing full-payment Easebuzz checkout unchanged.
- Add only the minimum required admin/customer display fields for advance paid and balance due.
- Store Easebuzz payment-link reference IDs for reconciliation.
- Use callbacks/webhooks as the source of truth.
- Add a manual admin fallback only if Easebuzz callback support is limited.

If Path B is confirmed:

- Add a proper payment schedule or payment transaction model.
- Do not overload `orders.payment_status` with too many meanings.
- Keep full-payment orders working exactly as they work today.
- Add typed TypeScript models. Do not use `any`.
- Add amount validation per payment leg, not only against full order total.
- Add idempotency so duplicate callbacks do not double-update the order.
- Add clear admin and customer labels:
  - Advance Due
  - Advance Paid
  - Balance Due
  - Fully Paid
  - Payment Overdue
  - Refunded

Quality checks required for any code implementation:

- `pnpm.cmd lint`
- `pnpm.cmd exec tsc --noEmit`
- `pnpm.cmd build`

---

## 10. Simple Recommendation

For the current Toycker prototype, do not change the checkout flow yet. First confirm Easebuzz Partial Payment Links for Toycker's account. If confirmed, use that as the first simple prototype path, then add only the minimum Toycker-side tracking needed for advance paid and balance due.

