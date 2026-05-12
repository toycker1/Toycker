"use client"

import dynamic from "next/dynamic"
import React from "react"
import { Cart, PaymentSession } from "@/lib/supabase/types"
import { isStripeLike } from "@lib/constants"

type PaymentWrapperProps = {
  cart: Cart
  children: React.ReactNode
}

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_KEY
const StripeWrapper = dynamic(() => import("./stripe-wrapper"), {
  ssr: false,
})

const PaymentWrapper: React.FC<PaymentWrapperProps> = ({ cart, children }) => {
  const paymentSession = cart.payment_collection?.payment_sessions?.find(
    (session: PaymentSession) => session.status === "pending"
  )

  if (
    isStripeLike(paymentSession?.provider_id) &&
    paymentSession &&
    stripeKey
  ) {
    return (
      <StripeWrapper
        paymentSession={paymentSession}
        stripeKey={stripeKey}
      >
        {children}
      </StripeWrapper>
    )
  }

  return <div>{children}</div>
}

export default PaymentWrapper
