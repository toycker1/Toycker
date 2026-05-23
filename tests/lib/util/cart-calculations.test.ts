import { describe, expect, it } from "vitest"

import {
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
})
