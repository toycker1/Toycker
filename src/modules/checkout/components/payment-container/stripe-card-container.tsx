"use client"

import { useContext, useMemo, type JSX } from "react"
import { CardElement } from "@stripe/react-stripe-js"
import type { StripeCardElementOptions } from "@stripe/stripe-js"

import { Text } from "@modules/common/components/text"
import SkeletonCardDetails from "@modules/skeletons/components/skeleton-card-details"
import PaymentContainer from "@modules/checkout/components/payment-container"
import { StripeContext } from "../payment-wrapper/stripe-wrapper"

type StripeCardContainerProps = {
  paymentProviderId: string
  selectedPaymentOptionId: string | null
  disabled?: boolean
  badgeLabel?: string | null
  paymentInfoMap: Record<
    string,
    { title: string; icon: JSX.Element; description?: string }
  >
  setCardBrand: (_brand: string) => void
  setError: (_error: string | null) => void
  setCardComplete: (_complete: boolean) => void
}

const StripeCardContainer = ({
  paymentProviderId,
  selectedPaymentOptionId,
  paymentInfoMap,
  disabled = false,
  badgeLabel = null,
  setCardBrand,
  setError,
  setCardComplete,
}: StripeCardContainerProps) => {
  const stripeReady = useContext(StripeContext)

  const options: StripeCardElementOptions = useMemo(
    () => ({
      style: {
        base: {
          fontFamily: "Inter, sans-serif",
          color: "#1f2937",
          fontSize: "16px",
          "::placeholder": {
            color: "#9ca3af",
          },
        },
      },
      classes: {
        base: "block w-full px-4 py-3.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all",
      },
    }),
    []
  )

  return (
    <PaymentContainer
      paymentProviderId={paymentProviderId}
      selectedPaymentOptionId={selectedPaymentOptionId}
      paymentInfoMap={paymentInfoMap}
      disabled={disabled}
      badgeLabel={badgeLabel}
    >
      {selectedPaymentOptionId === paymentProviderId &&
        (stripeReady ? (
          <div>
            <Text className="text-sm font-semibold text-gray-800 mb-3 block">
              Card details
            </Text>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <CardElement
                options={options}
                onChange={(event) => {
                  setCardBrand(
                    event.brand
                      ? event.brand.charAt(0).toUpperCase() + event.brand.slice(1)
                      : ""
                  )
                  setError(event.error?.message || null)
                  setCardComplete(event.complete)
                }}
              />
            </div>
          </div>
        ) : (
          <div>
            <SkeletonCardDetails />
          </div>
        ))}
    </PaymentContainer>
  )
}

export default StripeCardContainer
