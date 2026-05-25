import { describe, expect, it } from "vitest"

import {
  calculatePartialPaymentSplit,
  calculateCartTotals,
  DatabaseCartItem,
  isFullOnlinePaymentProvider,
  mapCartItems,
  roundCurrencyAmount,
} from "@/lib/util/cart-calculations"
import { CartProductSummary, Promotion } from "@/lib/supabase/types"

const product: CartProductSummary = {
  id: "prod_1399",
  handle: "test-toy",
  name: "Test Toy",
  price: 1399,
  currency_code: "inr",
  image_url: null,
  thumbnail: null,
  images: null,
  metadata: null,
  status: "active",
}

const cartItem: DatabaseCartItem = {
  id: "item_1",
  cart_id: "cart_1",
  product_id: product.id,
  variant_id: null,
  quantity: 1,
  created_at: "2026-05-23T00:00:00.000Z",
  updated_at: "2026-05-23T00:00:00.000Z",
  product,
  variant: null,
  metadata: {},
}

describe("cart pricing calculations", () => {
  it("keeps club and full online payment discounts at 2 decimal places", () => {
    const items = mapCartItems([cartItem], 5)
    const totals = calculateCartTotals({
      items,
      promotion: null,
      shippingMethods: null,
      availableRewards: 0,
      cartMetadata: {},
      isClubMember: true,
      clubDiscountPercentage: 5,
      paymentDiscountPercentage: 5,
      defaultShippingOption: null,
    })

    expect(totals.club_savings).toBe(69.95)
    expect(totals.item_subtotal).toBe(1329.05)
    expect(totals.payment_discount).toBe(66.45)
    expect(totals.total).toBe(1262.6)
  })

  it("does not apply payment discount when the percentage is zero", () => {
    const items = mapCartItems([cartItem], 5)
    const totals = calculateCartTotals({
      items,
      promotion: null,
      shippingMethods: null,
      availableRewards: 0,
      cartMetadata: {},
      isClubMember: true,
      clubDiscountPercentage: 5,
      paymentDiscountPercentage: 0,
      defaultShippingOption: null,
    })

    expect(totals.payment_discount).toBe(0)
    expect(totals.total).toBe(1329.05)
  })

  it("keeps percentage promo discounts at 2 decimal places", () => {
    const promotion: Promotion = {
      id: "promo_1",
      code: "SAVE5",
      type: "percentage",
      value: 5,
      min_order_amount: 0,
      is_active: true,
      is_deleted: false,
      starts_at: null,
      ends_at: null,
      max_uses: null,
      used_count: 0,
      created_at: "2026-05-23T00:00:00.000Z",
      updated_at: "2026-05-23T00:00:00.000Z",
    }

    const items = mapCartItems([cartItem], 5)
    const totals = calculateCartTotals({
      items,
      promotion,
      shippingMethods: null,
      availableRewards: 0,
      cartMetadata: {},
      isClubMember: true,
      clubDiscountPercentage: 5,
      paymentDiscountPercentage: 0,
      defaultShippingOption: null,
    })

    expect(totals.discount_total).toBe(66.45)
    expect(totals.total).toBe(1262.6)
  })

  it("identifies only full online payment providers", () => {
    expect(isFullOnlinePaymentProvider("pp_payu_payu")).toBe(true)
    expect(isFullOnlinePaymentProvider("pp_easebuzz_easebuzz")).toBe(true)
    expect(isFullOnlinePaymentProvider("pp_easebuzz_partial_payment")).toBe(false)
    expect(isFullOnlinePaymentProvider("pp_system_default")).toBe(false)
    expect(isFullOnlinePaymentProvider(null)).toBe(false)
  })

  it("rounds currency values to 2 decimals", () => {
    expect(roundCurrencyAmount(66.452)).toBe(66.45)
    expect(roundCurrencyAmount(1262.599)).toBe(1262.6)
  })

  it("rounds partial payment cash balance down to the nearest 10 rupees", () => {
    const split = calculatePartialPaymentSplit(1091.55, 20)

    expect(split.rawAdvanceAmount).toBe(218.31)
    expect(split.rawBalanceAmount).toBe(873.24)
    expect(split.advanceAmount).toBe(221.55)
    expect(split.balanceAmount).toBe(870)
    expect(roundCurrencyAmount(split.advanceAmount + split.balanceAmount)).toBe(
      1091.55
    )
  })

  it("moves partial payment rounded-balance difference into the online advance", () => {
    const split = calculatePartialPaymentSplit(1329.05, 20)

    expect(split.rawAdvanceAmount).toBe(265.81)
    expect(split.rawBalanceAmount).toBe(1063.24)
    expect(split.advanceAmount).toBe(269.05)
    expect(split.balanceAmount).toBe(1060)
    expect(roundCurrencyAmount(split.advanceAmount + split.balanceAmount)).toBe(
      1329.05
    )
  })

  it("keeps a whole-rupee partial balance for a 2299 club-price order", () => {
    const split = calculatePartialPaymentSplit(2184.05, 20)

    expect(split.rawAdvanceAmount).toBe(436.81)
    expect(split.rawBalanceAmount).toBe(1747.24)
    expect(split.advanceAmount).toBe(444.05)
    expect(split.balanceAmount).toBe(1740)
    expect(roundCurrencyAmount(split.advanceAmount + split.balanceAmount)).toBe(
      2184.05
    )
  })

  it("keeps non-club partial payment totals exact after cash balance rounding", () => {
    const split = calculatePartialPaymentSplit(1149, 20)

    expect(split.rawAdvanceAmount).toBe(229.8)
    expect(split.rawBalanceAmount).toBe(919.2)
    expect(split.advanceAmount).toBe(239)
    expect(split.balanceAmount).toBe(910)
    expect(roundCurrencyAmount(split.advanceAmount + split.balanceAmount)).toBe(
      1149
    )
  })

  it("does not adjust partial payment when the cash balance is already clean", () => {
    const split = calculatePartialPaymentSplit(1000, 20)

    expect(split.rawAdvanceAmount).toBe(200)
    expect(split.rawBalanceAmount).toBe(800)
    expect(split.advanceAmount).toBe(200)
    expect(split.balanceAmount).toBe(800)
  })

  it("moves the full amount online when the cash balance is below 10 rupees", () => {
    const split = calculatePartialPaymentSplit(9.99, 20)

    expect(split.rawAdvanceAmount).toBe(2)
    expect(split.rawBalanceAmount).toBe(7.99)
    expect(split.advanceAmount).toBe(9.99)
    expect(split.balanceAmount).toBe(0)
  })

  it("returns a safe empty partial payment split for invalid inputs", () => {
    expect(calculatePartialPaymentSplit(1329.05, 0).advanceAmount).toBe(0)
    expect(calculatePartialPaymentSplit(1329.05, 100).balanceAmount).toBe(0)
    expect(calculatePartialPaymentSplit(1329.05, Number.NaN).fullOrderAmount).toBe(
      1329.05
    )
    expect(calculatePartialPaymentSplit(Number.NaN, 20).fullOrderAmount).toBe(0)
  })
})
