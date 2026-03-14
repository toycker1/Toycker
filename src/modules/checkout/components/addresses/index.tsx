"use client"

import React from "react"
import { Text } from "@modules/common/components/text"
import { Cart, CustomerProfile, ShippingOption } from "@/lib/supabase/types"

import BillingAddress from "../billing_address"
import ShippingAddress from "../shipping-address"
import { useCheckout } from "../../context/checkout-context"

const Addresses = ({
  cart,
  customer,
}: {
  cart: Cart
  customer: CustomerProfile | null
  availableShippingMethods?: ShippingOption[] | null
}) => {
  const { state, toggleShippingSameAsBilling } = useCheckout()

  return (
    <div>
      <div className="flex flex-row items-center justify-between mb-4">
        <Text
          as="h2"
          weight="bold"
          className="text-3xl flex items-center gap-2"
        >
          Billing Address
        </Text>
      </div>

      <div>
        <BillingAddress
          customer={customer}
          checked={state.shippingSameAsBilling}
          onChange={toggleShippingSameAsBilling}
          cart={cart}
        />

        {!state.shippingSameAsBilling && (
          <div className="mt-6">
            <Text
              as="h2"
              weight="bold"
              className="text-xl mb-4"
            >
              Shipping Address
            </Text>
            <ShippingAddress
              customer={customer}
              cart={cart}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default Addresses
