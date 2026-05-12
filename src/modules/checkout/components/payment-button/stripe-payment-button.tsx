"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useElements, useStripe } from "@stripe/react-stripe-js"

import { completeCheckout } from "@/lib/actions/complete-checkout"
import { Cart } from "@/lib/supabase/types"
import { Button } from "@modules/common/components/button"
import ErrorMessage from "@modules/checkout/components/error-message"
import { useCheckout } from "@modules/checkout/context/checkout-context"

type StripePaymentButtonProps = {
  cart: Cart
  notReady: boolean
  "data-testid"?: string
}

const StripePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: StripePaymentButtonProps) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { state, isPaymentUpdating } = useCheckout()
  const router = useRouter()

  const stripe = useStripe()
  const elements = useElements()
  const card = elements?.getElement("card")

  const disabled = !stripe || !elements || notReady || isPaymentUpdating

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    if (!stripe || !elements || !card || !cart) {
      setSubmitting(false)
      return
    }

    const billingAddress = state.billingAddress
    const shippingAddress = state.shippingAddress
    const paymentMethod = state.paymentMethod

    if (!billingAddress || !shippingAddress || !paymentMethod) {
      setErrorMessage("Please fill all required fields")
      setSubmitting(false)
      return
    }

    try {
      const result = await completeCheckout({
        cartId: cart.id,
        email: state.email || "",
        shippingAddress,
        billingAddress,
        paymentMethod,
        rewardsToApply: state.rewardsToApply,
        saveAddress: state.saveAddress,
      })

      if (!result.success) {
        setErrorMessage(result.error || "Order creation failed")
        setSubmitting(false)
        return
      }

      const clientSecret = result.paymentData?.client_secret
      if (clientSecret) {
        const { error: confirmError, paymentIntent } =
          await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
              card,
              billing_details: {
                name: `${billingAddress.first_name} ${billingAddress.last_name}`,
                email: state.email || undefined,
                phone: billingAddress.phone || undefined,
                address: {
                  line1: billingAddress.address_1,
                  line2: billingAddress.address_2 || undefined,
                  city: billingAddress.city,
                  postal_code: billingAddress.postal_code,
                  country: billingAddress.country_code,
                },
              },
            },
          })

        if (confirmError) {
          setErrorMessage(confirmError.message || "Payment confirmation failed")
          setSubmitting(false)
          return
        }

        if (
          paymentIntent?.status !== "succeeded" &&
          paymentIntent?.status !== "requires_capture"
        ) {
          setErrorMessage("Payment status is not authorized")
          setSubmitting(false)
          return
        }
      }

      router.push(`/order/confirmed/${result.orderId}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Payment failed")
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        disabled={disabled || submitting}
        onClick={handlePayment}
        size="large"
        isLoading={submitting}
        className="w-full hover:bg-primary"
        data-testid={dataTestId}
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="stripe-payment-error-message"
      />
    </>
  )
}

export default StripePaymentButton
