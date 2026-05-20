"use client"

import { RadioGroup } from "@headlessui/react"
import dynamic from "next/dynamic"
import {
  getPaymentMethodBadgeLabel,
  isEasebuzzPartialPayment,
  isStripeLike,
  isTemporarilyDisabledPaymentMethod,
  paymentInfoMap,
} from "@lib/constants"
import { convertToLocale } from "@lib/util/money"
import { Text } from "@modules/common/components/text"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer from "@modules/checkout/components/payment-container"
import { useEffect, useMemo, useState } from "react"
import { Cart } from "@/lib/supabase/types"
import { useCheckout } from "../../context/checkout-context"

const StripeCardContainer = dynamic(
  () => import("@modules/checkout/components/payment-container/stripe-card-container"),
  { ssr: false }
)

const Payment = ({
  cart,
  availablePaymentMethods,
}: {
  cart: Cart
  availablePaymentMethods: {
    id: string
    name: string
    description?: string | null
    partial_payment_percentage?: number | null
  }[]
}) => {
  const { state, setPaymentMethod } = useCheckout()

  const [error, setError] = useState<string | null>(null)

  const paidByGiftcard = (cart.gift_card_total ?? 0) > 0 && cart.total === 0
  const selectedPaymentMethod = isTemporarilyDisabledPaymentMethod(
    state.paymentMethod
  )
    ? null
    : state.paymentMethod
  const enabledPaymentMethods = useMemo(
    () =>
      availablePaymentMethods.filter(
        (paymentMethod) =>
          !isTemporarilyDisabledPaymentMethod(paymentMethod.id)
      ),
    [availablePaymentMethods]
  )

  // Auto-select the first enabled payment method when nothing selectable is set.
  useEffect(() => {
    if (!selectedPaymentMethod && enabledPaymentMethods.length && !paidByGiftcard) {
      const firstMethod = enabledPaymentMethods[0]
      if (firstMethod) {
        setPaymentMethod(firstMethod.id)
      }
    }
  }, [enabledPaymentMethods, selectedPaymentMethod, paidByGiftcard, setPaymentMethod])

  const handlePaymentMethodChange = (method: string) => {
    if (isTemporarilyDisabledPaymentMethod(method)) {
      return
    }

    setError(null)
    setPaymentMethod(method)
  }

  const getPartialPaymentPreview = (percentage: number | null | undefined) => {
    const normalizedPercentage =
      typeof percentage === "number" && percentage > 0 && percentage < 100
        ? percentage
        : 20
    const total = Number(cart.total || 0)
    const advanceAmount = Math.round(total * (normalizedPercentage / 100))
    const balanceAmount = Math.max(0, total - advanceAmount)

    return (
      <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-indigo-900">
            Pay now ({normalizedPercentage}%)
          </span>
          <span className="font-black text-indigo-900">
            {convertToLocale({
              amount: advanceAmount,
              currency_code: cart.currency_code,
            })}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-indigo-700">
          <span>Remaining balance</span>
          <span className="font-bold">
            {convertToLocale({
              amount: balanceAmount,
              currency_code: cart.currency_code,
            })}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-4">
        <Text
          as="h2"
          weight="bold"
          className="text-3xl"
        >
          Payment Method
        </Text>
      </div>

      <div>
        {!paidByGiftcard && availablePaymentMethods?.length ? (
          <RadioGroup
            value={selectedPaymentMethod || ""}
            onChange={handlePaymentMethodChange}
          >
            {availablePaymentMethods.map((paymentMethod) => (
              <div key={paymentMethod.id}>
                {isStripeLike(paymentMethod.id) ? (
                  <StripeCardContainer
                    paymentProviderId={paymentMethod.id}
                    selectedPaymentOptionId={selectedPaymentMethod || ""}
                    paymentInfoMap={paymentInfoMap}
                    disabled={isTemporarilyDisabledPaymentMethod(paymentMethod.id)}
                    badgeLabel={getPaymentMethodBadgeLabel(paymentMethod.id)}
                    setCardBrand={() => { }}
                    setError={setError}
                    setCardComplete={() => { }}
                  />
                ) : (
                  <PaymentContainer
                    paymentInfoMap={paymentInfoMap}
                    paymentProviderId={paymentMethod.id}
                    selectedPaymentOptionId={selectedPaymentMethod || ""}
                    disabled={isTemporarilyDisabledPaymentMethod(paymentMethod.id)}
                    badgeLabel={getPaymentMethodBadgeLabel(paymentMethod.id)}
                  >
                    {isEasebuzzPartialPayment(paymentMethod.id)
                      ? getPartialPaymentPreview(
                          paymentMethod.partial_payment_percentage
                        )
                      : null}
                  </PaymentContainer>
                )}
              </div>
            ))}
          </RadioGroup>
        ) : paidByGiftcard ? (
          <div className="flex flex-col">
            <Text weight="bold" className="text-sm text-gray-900 mb-1">
              Payment method
            </Text>
            <Text
              className="text-sm text-gray-500"
              data-testid="payment-method-summary"
            >
              Gift card (fully covers order)
            </Text>
          </div>
        ) : (
          <Text className="text-sm text-gray-500">
            No payment methods available
          </Text>
        )}

        <ErrorMessage
          error={error}
          data-testid="payment-method-error-message"
        />
      </div>
    </div>
  )
}

export default Payment
