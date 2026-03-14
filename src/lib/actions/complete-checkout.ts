"use server"

import { z } from "zod"
import { revalidateTag } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { PaymentCollection } from "@/lib/supabase/types"

// Validation schema for checkout data
const AddressSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  address_1: z.string().min(1, "Address is required"),
  address_2: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  province: z.string().optional().nullable(),
  postal_code: z.string().min(1, "Postal code is required"),
  country_code: z.string().min(2, "Country is required"),
  phone: z.string().optional().nullable(),
})

const CheckoutSchema = z.object({
  cartId: z.string().min(1, "Cart ID is required"),
  email: z.string().email("Invalid email address"),
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema,
  paymentMethod: z.string().min(1, "Payment method is required"),
  rewardsToApply: z.number().int().min(0).optional().default(0),
  saveAddress: z.boolean().optional(),
})

export type CheckoutData = z.infer<typeof CheckoutSchema>

export interface CheckoutPaymentData {
  client_secret?: string
  payment_url?: string
  params?: Record<string, string | number | boolean | null | undefined>
  [key: string]: unknown
}

export interface CheckoutResult {
  success: boolean
  orderId?: string
  paymentData?: CheckoutPaymentData | null
  error?: string
}

type CheckoutProfileRow = {
  first_name: string | null
  last_name: string | null
  phone: string | null
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  const trimmedValue = value?.trim()
  return trimmedValue ? trimmedValue : null
}

function isBlank(value: string | null | undefined): boolean {
  return !value?.trim()
}

function mapCheckoutAddressToSavedAddress(address: CheckoutData["billingAddress"]) {
  return {
    first_name: address.first_name.trim(),
    last_name: address.last_name.trim(),
    address_1: address.address_1.trim(),
    address_2: normalizeOptionalValue(address.address_2),
    company: normalizeOptionalValue(address.address_2),
    postal_code: address.postal_code.trim(),
    city: address.city.trim(),
    country_code: address.country_code.trim().toLowerCase(),
    province: normalizeOptionalValue(address.province),
    phone: normalizeOptionalValue(address.phone),
  }
}

export async function completeCheckout(
  data: CheckoutData
): Promise<CheckoutResult> {
  try {
    // Validate input data
    const validatedData = CheckoutSchema.parse(data)

    const supabase = await createClient()

    // Step 1: Initialize payment session (generates client secrets, PayU hashes, etc.)
    // This updates the cart in the DB with the necessary payment data
    const { initiatePaymentSession } = await import("@lib/data/cart")
    await initiatePaymentSession(
      { id: validatedData.cartId },
      {
        provider_id: validatedData.paymentMethod,
        customerEmail: validatedData.email,
        customerAddress: validatedData.billingAddress,
      }
    )

    // Step 2: Call Supabase RPC function for atomic order creation
    // The RPC will now find the initialized payment session data in the cart record
    const { data: result, error } = await supabase.rpc(
      "create_order_with_payment",
      {
        p_cart_id: validatedData.cartId,
        p_email: validatedData.email,
        p_shipping_address: validatedData.shippingAddress,
        p_billing_address: validatedData.billingAddress,
        p_payment_provider: validatedData.paymentMethod,
        p_rewards_to_apply: validatedData.rewardsToApply,
      }
    )

    if (error) {
      console.error("Order creation error:", error)
      return {
        success: false,
        error: error.message || "Failed to create order. Please try again.",
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: existingProfile, error: profileReadError } = await supabase
        .from("profiles")
        .select("first_name, last_name, phone")
        .eq("id", user.id)
        .maybeSingle<CheckoutProfileRow>()

      if (profileReadError) {
        console.warn(
          "Failed to load profile before checkout profile sync:",
          profileReadError
        )
      }

      const profileUpdate: {
        contact_email: string
        first_name?: string
        last_name?: string
        phone?: string
      } = {
        contact_email: validatedData.email.trim(),
      }

      if (isBlank(existingProfile?.first_name)) {
        profileUpdate.first_name = validatedData.billingAddress.first_name.trim()
      }

      if (isBlank(existingProfile?.last_name)) {
        profileUpdate.last_name = validatedData.billingAddress.last_name.trim()
      }

      if (isBlank(existingProfile?.phone)) {
        const billingPhone = normalizeOptionalValue(validatedData.billingAddress.phone)
        if (billingPhone) {
          profileUpdate.phone = billingPhone
        }
      }

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", user.id)

      if (profileUpdateError) {
        console.warn(
          "Failed to persist checkout profile details:",
          profileUpdateError
        )
      } else {
        revalidateTag("customers", "max")
        revalidateTag("admin-customers", "max")
      }
    }

    // Auto-save address if requested
    if (validatedData.saveAddress && user) {
      try {
        const { saveCheckoutAddresses } = await import("@lib/data/cart")

        await saveCheckoutAddresses({
          billingAddress: mapCheckoutAddressToSavedAddress(
            validatedData.billingAddress
          ),
          shippingAddress: mapCheckoutAddressToSavedAddress(
            validatedData.shippingAddress
          ),
          userId: user.id,
        })
      } catch (err) {
        console.error("Failed to auto-save address during checkout:", err)
      }
    }

    // Fetch the created order to get any updated payment data (like Stripe client_secret)
    const { data: orderData } = await supabase
      .from("orders")
      .select("*, payment_collection")
      .eq("id", result.order_id)
      .single()

    // Step 3: For non-gateway payments (COD, manual), run post-order logic now.
    // Gateway payments (PayU) handle this in their callback after payment verification.
    const isGatewayPayment = validatedData.paymentMethod.includes("payu")

    if (!isGatewayPayment && orderData) {
      const { handlePostOrderLogic, retrieveCart } = await import(
        "@lib/data/cart"
      )
      const cart = await retrieveCart(validatedData.cartId)
      if (cart) {
        await handlePostOrderLogic(
          orderData,
          cart,
          validatedData.rewardsToApply
        )
      }
    }

    // Cart clearing is handled by ClearCartOnMount on the confirmation page
    // to avoid "Not Found" race conditions during payment gateway handoffs.

    return {
      success: true,
      orderId: result.order_id,
      paymentData:
        (((orderData?.payment_collection as PaymentCollection | null | undefined)
          ?.payment_sessions.find(
            (session) => session.provider_id === validatedData.paymentMethod
          )?.data as CheckoutPaymentData | undefined) ?? null),
    }
  } catch (error) {
    console.error("Checkout error:", error)

    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      return {
        success: false,
        error: firstError?.message || "Invalid checkout data",
      }
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.",
    }
  }
}
