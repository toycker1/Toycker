"use client"

import { convertToLocale } from "@lib/util/money"
import { Cart, Order } from "@/lib/supabase/types"
import React from "react"
import { ShippingPriceContext } from "@modules/common/context/shipping-price-context"
import { CheckoutContext } from "@modules/checkout/context/checkout-context"
import { isEasebuzzPartialPayment } from "@/lib/constants"
import { getPartialPaymentDisplayData } from "@/lib/util/order-pricing"

type CartTotalsProps = {
  totals: {
    total?: number | null
    subtotal?: number | null
    tax_total?: number | null
    currency_code: string
    item_subtotal?: number | null
    shipping_subtotal?: number | null
    shipping_total?: number | null
    discount_subtotal?: number | null
    payment_discount?: number | null
    payment_discount_percentage?: number | null
  }
  cart?: Cart
  order?: Order
  includePaymentDiscount?: boolean
  checkoutPartialPaymentPercentage?: number | null
}

const CartTotals: React.FC<CartTotalsProps> = ({
  totals,
  cart,
  order,
  includePaymentDiscount = true,
  checkoutPartialPaymentPercentage,
}) => {
  const {
    currency_code,
    tax_total,
  } = totals
  const normalizedCurrency = currency_code?.trim() || "INR"
  const shippingPriceCtx = React.useContext(ShippingPriceContext)
  const checkoutCtx = React.useContext(CheckoutContext)

  const selectedShippingPrice = shippingPriceCtx?.selectedShippingPrice

  // Extract discounts from order or cart
  let rewards_discount = 0
  let club_savings = 0
  let promoDiscount = 0
  let is_club_member = false

  if (order) {
    // For orders, extract from metadata
    const metadata = order.metadata as Record<string, unknown> | null
    // Check both naming conventions for rewards
    rewards_discount = (typeof metadata?.rewards_discount === 'number' ? metadata.rewards_discount : 0) ||
      (typeof metadata?.rewards_used === 'number' ? metadata.rewards_used : 0)
    club_savings = typeof metadata?.club_savings === 'number' ? metadata.club_savings : 0
    promoDiscount = typeof metadata?.promo_discount === 'number' ? metadata.promo_discount : 0
    is_club_member = metadata?.is_club_member === true
  } else {
    // For carts
    rewards_discount = checkoutCtx?.state?.rewardsToApply ?? cart?.rewards_discount ?? 0
    club_savings = cart?.club_savings ?? 0
    promoDiscount = cart?.discount_total || totals.discount_subtotal || 0
    is_club_member = cart?.is_club_member ?? false
  }

  // Extract payment discount
  let payment_discount = 0
  let payment_discount_percentage = 0
  if (order) {
    const metadata = order.metadata as Record<string, unknown> | null
    payment_discount = typeof metadata?.payment_discount_amount === 'number' ? metadata.payment_discount_amount : 0
    payment_discount_percentage = typeof metadata?.payment_discount_percentage === 'number' ? metadata.payment_discount_percentage : 0
  } else {
    payment_discount = totals.payment_discount ?? 0
    payment_discount_percentage = totals.payment_discount_percentage ?? 0
  }
  const displayPaymentDiscount = includePaymentDiscount ? payment_discount : 0
  const displayPaymentDiscountPercentage = includePaymentDiscount ? payment_discount_percentage : 0
  const partialPaymentData = getPartialPaymentDisplayData(order?.metadata)

  const discountSubtotal = promoDiscount + rewards_discount

  // Handle both Cart and Order types for subtotal
  const itemSubtotal = totals.item_subtotal ?? (order?.subtotal ?? null) ?? cart?.item_subtotal ?? cart?.subtotal ?? 0

  // Handle shipping from multiple sources
  const getDisplayShippingSubtotal = (): number => {
    // 1. Order always wins
    if (order?.shipping_total !== undefined && order.shipping_total !== null) {
      return order.shipping_total
    }

    // 2. Calculated total from lib (includes tentative/default shipping)
    if (typeof totals.shipping_total === "number") {
      return totals.shipping_total
    }

    // 3. Fallback to check methods in cart (legacy/safety)
    if (cart?.shipping_methods && cart.shipping_methods.length > 0) {
      const method = cart.shipping_methods[cart.shipping_methods.length - 1]
      const baseAmount = Number(method.amount || method.total || method.subtotal || 0)
      const threshold = method.min_order_free_shipping

      if (threshold !== null && threshold !== undefined && itemSubtotal >= Number(threshold)) {
        return 0
      }
      return baseAmount
    }

    // 4. Use the selected shipping price from context
    if (selectedShippingPrice && selectedShippingPrice > 0) {
      return selectedShippingPrice
    }

    // Default to the provided shipping_subtotal
    return totals.shipping_subtotal ?? cart?.shipping_subtotal ?? 0
  }

  const displayShippingSubtotal = getDisplayShippingSubtotal()

  // Check if shipping is free
  const isFreeShipping = displayShippingSubtotal === 0

  // Calculate the base subtotal (before club discount)
  const baseSubtotal = itemSubtotal + club_savings
  const finalTotal = Math.max(
    0,
    itemSubtotal +
      displayShippingSubtotal +
      (tax_total || 0) -
      (order
        ? order.discount_total || 0
        : discountSubtotal + displayPaymentDiscount)
  )
  const checkoutPartialPercentage =
    typeof checkoutPartialPaymentPercentage === "number" &&
    checkoutPartialPaymentPercentage > 0 &&
    checkoutPartialPaymentPercentage < 100
      ? checkoutPartialPaymentPercentage
      : 20
  const showCheckoutPartialBreakdown =
    !order &&
    isEasebuzzPartialPayment(checkoutCtx?.state.paymentMethod || "") &&
    finalTotal > 0
  const checkoutAdvanceAmount = showCheckoutPartialBreakdown
    ? Math.round(finalTotal * (checkoutPartialPercentage / 100))
    : 0
  const checkoutBalanceAmount = showCheckoutPartialBreakdown
    ? Math.max(0, finalTotal - checkoutAdvanceAmount)
    : 0

  return (
    <div className="flex flex-col gap-y-4">
      <div className="space-y-3.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-500 uppercase tracking-widest text-sm">Subtotal</span>
          <span className="font-bold text-slate-900" data-testid="cart-subtotal" data-value={baseSubtotal}>
            {convertToLocale({
              amount: baseSubtotal,
              currency_code: normalizedCurrency,
            })}
          </span>
        </div>

        {is_club_member && club_savings > 0 && (
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-blue-600 uppercase tracking-widest text-sm">Club Savings</span>
              <span className="bg-blue-600 text-sm text-white px-1.5 py-0.5 rounded-md uppercase tracking-wider">Member</span>
            </div>
            <span
              className="font-bold text-blue-600"
              data-testid="cart-club-savings"
              data-value={club_savings}
            >
              -{" "}
              {convertToLocale({
                amount: club_savings,
                currency_code: normalizedCurrency,
              })}
            </span>
          </div>
        )}

        {rewards_discount > 0 && (
          <div className="flex items-center justify-between py-1">
            <span className="font-medium text-emerald-600 uppercase tracking-widest text-sm">Reward Points</span>
            <span
              className="font-bold text-emerald-600"
              data-testid="cart-discount"
              data-value={rewards_discount}
            >
              -{" "}
              {convertToLocale({
                amount: rewards_discount,
                currency_code: normalizedCurrency,
              })}
            </span>
          </div>
        )}

        {promoDiscount > 0 && (
          <div className="flex items-center justify-between py-1">
            <span className="font-medium text-amber-600 uppercase tracking-widest text-sm">Promo Discount</span>
            <span
              className="font-bold text-amber-600"
              data-testid="cart-promo-discount"
              data-value={promoDiscount}
            >
              -{" "}
              {convertToLocale({
                amount: promoDiscount,
                currency_code: normalizedCurrency,
              })}
            </span>
          </div>
        )}

        {displayPaymentDiscount > 0 && (
          <div className="flex items-center justify-between py-1">
            <span className="font-medium text-pink-600 uppercase tracking-widest text-sm">Payment Discount ({displayPaymentDiscountPercentage}%)</span>
            <span
              className="font-bold text-pink-600"
              data-testid="cart-payment-discount"
              data-value={displayPaymentDiscount}
            >
              -{" "}
              {convertToLocale({
                amount: displayPaymentDiscount,
                currency_code: normalizedCurrency,
              })}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-500 uppercase tracking-widest text-sm">Shipping</span>
          <span className="font-bold text-slate-900" data-testid="cart-shipping" data-value={displayShippingSubtotal}>
            {isFreeShipping ? (
              <span className="text-emerald-500 font-bold uppercase tracking-widest">Free</span>
            ) : (
              convertToLocale({
                amount: displayShippingSubtotal,
                currency_code: normalizedCurrency,
              })
            )}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-500 uppercase tracking-widest">Taxes</span>
          <span className="font-bold text-slate-900" data-testid="cart-taxes" data-value={tax_total || 0}>
            {convertToLocale({
              amount: tax_total || 0,
              currency_code: normalizedCurrency,
            })}
          </span>
        </div>
      </div>

      <div className="mt-2 pt-5 border-t border-slate-100">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-bold uppercase tracking-[0.2em] text-slate-400">
              Final Total
            </span>
            <span className="text-sm text-slate-300 font-medium">
              Incl. all taxes
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span
              className="text-4xl font-black text-slate-900 tracking-tighter leading-none"
              data-testid="cart-total"
              data-value={finalTotal}
            >
              {convertToLocale({
                amount: finalTotal,
                currency_code: normalizedCurrency,
              })}
            </span>
          </div>
        </div>
      </div>

      {showCheckoutPartialBreakdown && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-bold uppercase tracking-widest text-indigo-700">
              Pay Now ({checkoutPartialPercentage}%)
            </span>
            <span className="font-black text-indigo-900">
              {convertToLocale({
                amount: checkoutAdvanceAmount,
                currency_code: normalizedCurrency,
              })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-bold uppercase tracking-widest text-slate-500">
              Balance Due
            </span>
            <span className="font-black text-slate-900">
              {convertToLocale({
                amount: checkoutBalanceAmount,
                currency_code: normalizedCurrency,
              })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span className="font-semibold">Full Order Total</span>
            <span className="font-bold">
              {convertToLocale({
                amount: finalTotal,
                currency_code: normalizedCurrency,
              })}
            </span>
          </div>
        </div>
      )}

      {partialPaymentData && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-bold uppercase tracking-widest text-blue-600">
              Advance Paid
            </span>
            <span className="font-black text-blue-600">
              {convertToLocale({
                amount: partialPaymentData.advanceAmount,
                currency_code: normalizedCurrency,
              })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-bold uppercase tracking-widest text-slate-500">
              Balance Due
            </span>
            <span className="font-black text-slate-900">
              {convertToLocale({
                amount: partialPaymentData.balanceAmount,
                currency_code: normalizedCurrency,
              })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-bold uppercase tracking-widest text-slate-500">
              Balance Remaining
            </span>
            <span
              className={`font-black ${
                partialPaymentData.balanceRemainingAmount > 0
                  ? "text-amber-700"
                  : "text-emerald-700"
              }`}
            >
              {convertToLocale({
                amount: partialPaymentData.balanceRemainingAmount,
                currency_code: normalizedCurrency,
              })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-bold uppercase tracking-widest text-slate-500">
              Balance Status
            </span>
            <span
              className={`font-black ${
                partialPaymentData.balancePaymentStatus === "paid"
                  ? "text-emerald-700"
                  : "text-amber-700"
              }`}
            >
              {partialPaymentData.balancePaymentStatus === "paid"
                ? "Paid"
                : "Pending"}
            </span>
          </div>
          {partialPaymentData.balancePaymentMethod && (
            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-bold uppercase tracking-widest text-slate-500">
                Balance Method
              </span>
              <span className="font-black text-slate-900 text-right">
                {partialPaymentData.balancePaymentMethod}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CartTotals
