"use client"

import { loadStripe } from "@stripe/stripe-js"
import type { Stripe, StripeElementsOptions } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import { PaymentSession } from "@/lib/supabase/types"
import { createContext } from "react"

type StripeWrapperProps = {
  paymentSession: PaymentSession
  stripeKey?: string
  children: React.ReactNode
}

export const StripeContext = createContext(false)
const stripePromiseCache = new Map<string, Promise<Stripe | null>>()

const getStripePromise = (stripeKey: string) => {
  const cachedPromise = stripePromiseCache.get(stripeKey)
  if (cachedPromise) {
    return cachedPromise
  }

  const stripePromise = loadStripe(stripeKey)
  stripePromiseCache.set(stripeKey, stripePromise)
  return stripePromise
}

const StripeWrapper: React.FC<StripeWrapperProps> = ({
  paymentSession,
  stripeKey,
  children,
}) => {
  const options: StripeElementsOptions = {
    clientSecret: paymentSession!.data?.client_secret as string | undefined,
  }

  if (!stripeKey) {
    throw new Error(
      "Stripe key is missing. Set NEXT_PUBLIC_STRIPE_KEY environment variable."
    )
  }

  if (!paymentSession?.data?.client_secret) {
    throw new Error(
      "Stripe client secret is missing. Cannot initialize Stripe."
    )
  }

  return (
    <StripeContext.Provider value={true}>
      <Elements options={options} stripe={getStripePromise(stripeKey)}>
        {children}
      </Elements>
    </StripeContext.Provider>
  )
}

export default StripeWrapper
