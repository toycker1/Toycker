import { NextRequest, NextResponse } from "next/server"
import { verifyEasebuzzHash, EasebuzzCallbackPayload } from "@/lib/easebuzz"
import { createAdminClient } from "@/lib/supabase/admin"
import { Address, Cart, Order } from "@/lib/supabase/types"
import { retrieveCart } from "@/lib/data/cart"
import {
  currencyAmountsMatch,
  getOrderPricingMetadata,
  getPendingPaymentProviderId,
  OrderPricingMetadata,
} from "@/lib/util/order-pricing"
import { getCustomerFacingEmail } from "@/lib/util/customer-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RECENT_CALLBACKS = new Map<string, number>()
const THROTTLE_MS = 2000
const EASEBUZZ_PROVIDER_ID = "pp_easebuzz_easebuzz"

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>

type CreateOrderWithPaymentResponse = {
  success?: boolean
  order_id?: string
}

type EasebuzzOrderSnapshot = {
  email: string
  shippingAddress: Address
  billingAddress: Address
  paymentProviderId: string
  rewardsToApply: number
}

function htmlRedirect(path: string) {
  return new NextResponse(
    `<!doctype html><html><head><title>Redirecting...</title><meta charset="utf-8"></head>
     <body>
      <p>Processing payment response...</p>
      <script>window.location.replace(${JSON.stringify(path)})</script>
     </body></html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  )
}

const normalizeIp = (value: string | null): string =>
  value?.split(",")[0]?.trim() || "unknown"

const buildEasebuzzOrderSnapshot = (
  cart: Cart,
  fallbackEmail: string
): EasebuzzOrderSnapshot | null => {
  const shippingAddress = cart.shipping_address
  const billingAddress = cart.billing_address ?? cart.shipping_address

  if (!shippingAddress || !billingAddress) {
    return null
  }

  const rewardsToApplyFromMetadata =
    typeof cart.metadata?.rewards_to_apply === "number"
      ? cart.metadata.rewards_to_apply
      : Number(cart.rewards_to_apply ?? 0)

  return {
    email:
      getCustomerFacingEmail(fallbackEmail, cart.email) || "guest@toycker.in",
    shippingAddress,
    billingAddress,
    paymentProviderId:
      getPendingPaymentProviderId(cart.payment_collection) ||
      EASEBUZZ_PROVIDER_ID,
    rewardsToApply: Number.isFinite(rewardsToApplyFromMetadata)
      ? rewardsToApplyFromMetadata
      : 0,
  }
}

const fetchLatestOrderForCart = async (
  supabase: AdminClient,
  cartId: string
): Promise<Order | null> => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .contains("metadata", { cart_id: cartId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? (data as Order) : null
}

const refreshPendingOrderSnapshot = async (
  supabase: AdminClient,
  cartId: string,
  snapshot: EasebuzzOrderSnapshot
): Promise<Order> => {
  const { data, error } = await supabase.rpc("create_order_with_payment", {
    p_cart_id: cartId,
    p_email: snapshot.email,
    p_shipping_address: snapshot.shippingAddress,
    p_billing_address: snapshot.billingAddress,
    p_payment_provider: snapshot.paymentProviderId,
    p_rewards_to_apply: snapshot.rewardsToApply,
  })

  if (error) {
    throw new Error(error.message)
  }

  const result = data as CreateOrderWithPaymentResponse | null
  if (!result?.order_id) {
    throw new Error("create_order_with_payment did not return an order id")
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", result.order_id)
    .single()

  if (orderError || !order) {
    throw new Error(orderError?.message || "Failed to load refreshed order")
  }

  return order as Order
}

const mergeEasebuzzMetadata = (
  metadata: unknown,
  payload: EasebuzzCallbackPayload,
  paymentMethod: string
): OrderPricingMetadata => ({
  ...getOrderPricingMetadata(metadata),
  easebuzz_payload: payload,
  payment_method: paymentMethod,
})

export async function POST(request: NextRequest) {
  const ip = normalizeIp(request.headers.get("x-forwarded-for"))
  const now = Date.now()
  const lastHit = RECENT_CALLBACKS.get(ip)

  if (lastHit && now - lastHit < THROTTLE_MS) {
    console.warn("[EASEBUZZ] Throttling possible duplicate callback for IP:", ip)
    return new NextResponse("Throttled", { status: 429 })
  }
  RECENT_CALLBACKS.set(ip, now)

  if (RECENT_CALLBACKS.size > 1000) {
    RECENT_CALLBACKS.clear()
  }

  try {
    const bodyText = await request.text()
    const params = new URLSearchParams(bodyText)
    const payload = Object.fromEntries(
      params.entries()
    ) as EasebuzzCallbackPayload

    if (process.env.NODE_ENV === "development") {
      console.log("[EASEBUZZ] Callback hit:", {
        status: payload.status,
        txnid: payload.txnid,
        amount: payload.amount,
        easepayid: payload.easepayid,
        key: payload.key?.substring(0, 6) + "...",
      })
    }

    const salt = process.env.EASEBUZZ_MERCHANT_SALT
    if (!salt) {
      console.error(
        "[EASEBUZZ] Configuration error: Missing EASEBUZZ_MERCHANT_SALT env var"
      )
      return htmlRedirect("/checkout?step=payment&error=configuration_error")
    }

    if (!verifyEasebuzzHash(payload, salt)) {
      console.error(
        "[EASEBUZZ] Hash verification failed for txnid:",
        payload.txnid
      )
      return htmlRedirect("/checkout?step=payment&error=invalid_hash")
    }

    const status = payload.status
    const cartId = payload.udf1 || ""
    const txnid = payload.txnid
    const easepayid = payload.easepayid || txnid
    const amount = payload.amount
    const email = payload.email

    if (process.env.NODE_ENV === "development") {
      console.log("[EASEBUZZ] Processing payment:", {
        status,
        cartId,
        txnid,
        easepayid,
        amount,
      })
    }

    if (status === "success") {
      const supabase = await createAdminClient()
      const cart = await retrieveCart(cartId)

      if (!cart) {
        console.error("[EASEBUZZ] Cart not found:", cartId)
        return htmlRedirect("/checkout?error=cart_not_found")
      }

      const snapshot = buildEasebuzzOrderSnapshot(cart, email)
      let orderToFinalize = await fetchLatestOrderForCart(supabase, cartId)

      const shouldRefreshPendingSnapshot =
        !orderToFinalize ||
        (orderToFinalize.payment_status !== "captured" &&
          !orderToFinalize.payment_method)

      if (shouldRefreshPendingSnapshot) {
        if (!snapshot) {
          console.error(
            "[EASEBUZZ] Missing checkout snapshot data for cart:",
            cartId
          )
          return htmlRedirect("/checkout?error=missing_checkout_snapshot")
        }

        try {
          orderToFinalize = await refreshPendingOrderSnapshot(
            supabase,
            cartId,
            snapshot
          )
        } catch (refreshError) {
          console.error(
            "[EASEBUZZ] Failed to refresh pending order snapshot:",
            refreshError
          )
          return htmlRedirect(
            "/checkout?error=order_snapshot_refresh_failed"
          )
        }
      }

      if (!orderToFinalize) {
        console.error("[EASEBUZZ] No order available for cart:", cartId)
        return htmlRedirect("/checkout?error=order_not_found")
      }

      const paymentMethod =
        snapshot?.paymentProviderId ||
        orderToFinalize.payment_method ||
        EASEBUZZ_PROVIDER_ID
      const orderAlreadyCaptured =
        orderToFinalize.payment_status === "captured"
      const existingMetadata = getOrderPricingMetadata(
        orderToFinalize.metadata
      )

      if (
        !orderAlreadyCaptured &&
        !currencyAmountsMatch(orderToFinalize.total_amount, amount)
      ) {
        const { logOrderEvent } = await import("@/lib/data/admin")
        await logOrderEvent(
          orderToFinalize.id,
          "note_added",
          "Payment Amount Mismatch",
          `Easebuzz amount ${amount} did not match stored order total ${orderToFinalize.total_amount}.`,
          "system"
        )

        console.error("[EASEBUZZ] Amount mismatch:", {
          orderId: orderToFinalize.id,
          orderTotal: orderToFinalize.total_amount,
          callbackAmount: amount,
        })

        return htmlRedirect("/checkout?step=payment&error=amount_mismatch")
      }

      const shouldUpdateGatewayDetails =
        !orderAlreadyCaptured ||
        !orderToFinalize.gateway_txn_id ||
        !orderToFinalize.payment_method ||
        !existingMetadata.easebuzz_payload

      let finalizedOrderData = orderToFinalize

      if (shouldUpdateGatewayDetails) {
        const metadata = mergeEasebuzzMetadata(
          orderToFinalize.metadata,
          payload,
          paymentMethod
        )

        const { data: updatedOrder, error: updateError } = await supabase
          .from("orders")
          .update({
            status: "order_placed",
            payment_status: "captured",
            payment_method: paymentMethod,
            gateway_txn_id: orderAlreadyCaptured
              ? orderToFinalize.gateway_txn_id || easepayid
              : easepayid,
            metadata,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderToFinalize.id)
          .select()
          .single()

        if (updateError || !updatedOrder) {
          console.error(
            "[EASEBUZZ] Order update failed:",
            updateError?.message || "Unknown error"
          )
          return htmlRedirect(
            "/checkout?error=order_update_failed_payment_success"
          )
        }

        finalizedOrderData = updatedOrder as Order
      }

      if (!orderAlreadyCaptured) {
        const { handlePostOrderLogic } = await import("@lib/data/cart")
        const { logOrderEvent } = await import("@/lib/data/admin")
        const finalizedMetadata = getOrderPricingMetadata(
          finalizedOrderData.metadata
        )
        const rewardsToApply = Number(finalizedMetadata.rewards_used ?? 0)

        await handlePostOrderLogic(finalizedOrderData, cart, rewardsToApply)
        await logOrderEvent(
          finalizedOrderData.id,
          "order_placed",
          "Order Placed",
          "Order confirmed via Easebuzz payment gateway callback.",
          "system"
        )
      }

      console.log(
        "[EASEBUZZ] Order processed successfully:",
        finalizedOrderData.id
      )

      const response = htmlRedirect(
        `/order/confirmed/${finalizedOrderData.id}`
      )
      response.cookies.delete("toycker_cart_id")
      return response
    }

    const failureReason = payload.error_Message || payload.error || "payment_failed"
    console.log("[EASEBUZZ] Payment failed:", { status, reason: failureReason })

    try {
      const supabase = await createAdminClient()
      const existingOrder = await fetchLatestOrderForCart(supabase, cartId)

      if (existingOrder && existingOrder.payment_status !== "captured") {
        await supabase
          .from("orders")
          .update({
            status: "cancelled",
            payment_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingOrder.id)

        const { logOrderEvent } = await import("@/lib/data/admin")
        await logOrderEvent(
          existingOrder.id,
          "payment_failed",
          "Payment Failed",
          `Payment attempt failed or was cancelled via Easebuzz. Reason: ${failureReason}`,
          "system"
        )
      }
    } catch (updateErr) {
      console.error(
        "[EASEBUZZ] Failed to update order status for failure:",
        updateErr
      )
    }

    return htmlRedirect(
      `/checkout?step=payment&error=${encodeURIComponent(
        failureReason
      )}&status=${encodeURIComponent(status)}`
    )
  } catch (error) {
    console.error("[EASEBUZZ] Callback fatal error:", error)
    return htmlRedirect("/checkout?error=callback_failed")
  }
}

export async function GET() {
  return new NextResponse("Easebuzz Callback Endpoint Active", { status: 200 })
}
