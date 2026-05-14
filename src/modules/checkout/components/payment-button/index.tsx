"use client"

import dynamic from "next/dynamic"
import {
  isEasebuzz,
  isManual,
  isPayU,
  isStripeLike,
  isTemporarilyDisabledPaymentMethod,
} from "@lib/constants"
import { Button } from "@modules/common/components/button"
import ErrorMessage from "@modules/checkout/components/error-message"
import { useCheckout } from "@modules/checkout/context/checkout-context"
import React, { useState } from "react"
import { Cart } from "@/lib/supabase/types"
import { completeCheckout } from "@/lib/actions/complete-checkout"
import { useRouter } from "next/navigation"

type PaymentButtonProps = {
  cart: Cart
  "data-testid": string
}

const StripePaymentButton = dynamic(
  () => import("./stripe-payment-button"),
  {
    ssr: false,
    loading: () => (
      <Button disabled size="large" className="w-full hover:bg-primary">
        Place order
      </Button>
    ),
  }
)

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  "data-testid": dataTestId,
}) => {
  const { state } = useCheckout()
  const selectedPaymentMethod = isTemporarilyDisabledPaymentMethod(
    state.paymentMethod
  )
    ? undefined
    : state.paymentMethod ?? undefined

  // Check if all required data is filled
  const notReady = !state.isValid

  switch (true) {
    case isStripeLike(selectedPaymentMethod):
      return (
        <StripePaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isManual(selectedPaymentMethod):
      return (
        <ManualTestPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isEasebuzz(selectedPaymentMethod):
      return (
        <EasebuzzPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isPayU(selectedPaymentMethod):
      return (
        <PayUPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    default:
      return <Button disabled>Select a payment method</Button>
  }
}

const ManualTestPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: Cart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { state, isPaymentUpdating } = useCheckout()
  const router = useRouter()

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

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

      // Redirect to order confirmation
      router.push(`/order/confirmed/${result.orderId}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Order failed")
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        disabled={notReady || submitting || isPaymentUpdating}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        className="w-full hover:bg-primary"
        data-testid={dataTestId}
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

const PayUPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: Cart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { state, isPaymentUpdating } = useCheckout()

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

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

      // For PayU, redirect to payment gateway by submitting a form
      if (result.paymentData?.payment_url && result.paymentData?.params) {
        const form = document.createElement("form")
        form.method = "POST"
        form.action = result.paymentData.payment_url

        Object.entries(result.paymentData.params).forEach(([key, value]) => {
          const input = document.createElement("input")
          input.type = "hidden"
          input.name = key
          input.value = String(value)
          form.appendChild(input)
        })

        document.body.appendChild(form)
        form.submit()
        return
      }

      setErrorMessage("Unable to start PayU payment. Please try again.")
      setSubmitting(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Payment failed")
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        disabled={notReady || submitting || isPaymentUpdating}
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
        data-testid="payu-payment-error-message"
      />
    </>
  )
}

const EasebuzzPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: Cart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { state, isPaymentUpdating } = useCheckout()

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

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

      // Easebuzz: redirect directly to the payment URL (no form POST needed)
      if (result.paymentData?.payment_url) {
        window.location.href = result.paymentData.payment_url
        return
      }

      setErrorMessage("Unable to start Easebuzz payment. Please try again.")
      setSubmitting(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Payment failed")
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        disabled={notReady || submitting || isPaymentUpdating}
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
        data-testid="easebuzz-payment-error-message"
      />
    </>
  )
}

export default PaymentButton
