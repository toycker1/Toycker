"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { logOrderEvent } from "@/lib/data/admin"

const ONLINE_PAYMENT_METHODS = [
  "pp_payu_payu",
  "pp_easebuzz_easebuzz",
  "pp_easebuzz_partial_payment",
] as const
const EASEBUZZ_PROVIDER_ID = "pp_easebuzz_easebuzz"
const EASEBUZZ_PARTIAL_PROVIDER_ID = "pp_easebuzz_partial_payment"
const EASEBUZZ_LINK_EXPIRY_SECONDS = 15 * 60
const EASEBUZZ_PAYMENT_EXPIRY_BUFFER_SECONDS = 60
const EASEBUZZ_PAYMENT_STALE_SECONDS =
  EASEBUZZ_LINK_EXPIRY_SECONDS + EASEBUZZ_PAYMENT_EXPIRY_BUFFER_SECONDS

type PendingPaymentOrder = {
  id: string
  payment_method: string | null
  status: string
  payment_status: string
  created_at: string
}

type ExpireEasebuzzPendingPaymentOptions = {
  olderThanSeconds?: number
}

async function markPendingPaymentOrderIncomplete(order: PendingPaymentOrder) {
  const supabase = await createAdminClient()

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "failed",
      payment_status: "failed",
      fulfillment_status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("status", "pending")
    .eq("payment_status", "pending")

  if (updateError) {
    console.error(
      "[markPendingPaymentOrderIncomplete] Failed to update order:",
      order.id,
      updateError.message
    )
    return false
  }

  const { revokeOrReplaceMembership } = await import("@lib/data/club")
  await revokeOrReplaceMembership(order.id, "payment_failed")

  try {
    await logOrderEvent(
      order.id,
      "payment_failed",
      "Payment Incomplete",
      "Easebuzz payment was not completed within the 15-minute payment window plus 1-minute buffer. Order marked as incomplete.",
      "system"
    )
  } catch (logError) {
    console.warn(
      "[markPendingPaymentOrderIncomplete] Failed to log event for order:",
      order.id,
      logError
    )
  }

  return true
}

export async function expireStaleEasebuzzPendingPayments(
  options: ExpireEasebuzzPendingPaymentOptions = {}
): Promise<{ expiredCount: number }> {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return { expiredCount: 0 }
  }

  const olderThanSeconds =
    options.olderThanSeconds ?? EASEBUZZ_PAYMENT_STALE_SECONDS
  const cutoff = new Date(Date.now() - olderThanSeconds * 1000).toISOString()
  const supabase = await createAdminClient()

  const { data: pendingOrders, error } = await supabase
    .from("orders")
    .select("id, payment_method, status, payment_status, created_at")
    .in("payment_method", [EASEBUZZ_PROVIDER_ID, EASEBUZZ_PARTIAL_PROVIDER_ID])
    .eq("status", "pending")
    .eq("payment_status", "pending")
    .lt("created_at", cutoff)

  if (error) {
    console.error(
      "[expireStaleEasebuzzPendingPayments] DB lookup failed:",
      error.message
    )
    return { expiredCount: 0 }
  }

  if (!pendingOrders || pendingOrders.length === 0) {
    return { expiredCount: 0 }
  }

  let expiredCount = 0

  for (const order of pendingOrders as PendingPaymentOrder[]) {
    const updated = await markPendingPaymentOrderIncomplete(order)
    if (updated) {
      expiredCount++
    }
  }

  return { expiredCount }
}

/**
 * Cancels any stale pending online-payment orders for the given cart.
 * Called when the user returns to checkout after a cancelled / abandoned payment,
 * and before a new order is created so state is always clean.
 *
 * @param olderThanSeconds - Only cancel orders created more than this many seconds ago.
 *   Use 0 (default) to cancel any age. Use a positive value (e.g. 300) on page-load
 *   cleanup to avoid accidentally cancelling a freshly created order that was just
 *   placed in the same request cycle (Next.js RSC re-render race condition).
 */
export async function cancelPendingPaymentOrders(
  cartId: string,
  olderThanSeconds = 0
): Promise<{ cancelledCount: number }> {
  if (!cartId) return { cancelledCount: 0 }

  const supabase = await createAdminClient()

  let query = supabase
    .from("orders")
    .select("id, payment_method, status, payment_status, created_at")
    .contains("metadata", { cart_id: cartId })
    .eq("status", "pending")
    .eq("payment_status", "pending")

  if (olderThanSeconds > 0) {
    const cutoff = new Date(Date.now() - olderThanSeconds * 1000).toISOString()
    query = query.lt("created_at", cutoff)
  }

  const { data: pendingOrders, error } = await query

  if (error) {
    console.error("[cancelPendingPaymentOrders] DB lookup failed:", error.message)
    return { cancelledCount: 0 }
  }

  if (!pendingOrders || pendingOrders.length === 0) {
    return { cancelledCount: 0 }
  }

  let cancelledCount = 0

  for (const order of pendingOrders as PendingPaymentOrder[]) {
    const method = order.payment_method ?? ""
    const isOnlinePayment = ONLINE_PAYMENT_METHODS.some((m) => method === m)
    if (!isOnlinePayment) continue

    if (
      method === EASEBUZZ_PROVIDER_ID ||
      method === EASEBUZZ_PARTIAL_PROVIDER_ID
    ) {
      const easebuzzCutoff = Date.now() - EASEBUZZ_PAYMENT_STALE_SECONDS * 1000
      const createdAt = Date.parse(order.created_at)
      if (
        olderThanSeconds > 0 &&
        Number.isFinite(createdAt) &&
        createdAt > easebuzzCutoff
      ) {
        continue
      }

      const updated = await markPendingPaymentOrderIncomplete(order)
      if (updated) {
        cancelledCount++
      }
      continue
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        payment_status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)

    if (updateError) {
      console.error(
        "[cancelPendingPaymentOrders] Failed to cancel order:",
        order.id,
        updateError.message
      )
      continue
    }

    const { revokeOrReplaceMembership } = await import("@lib/data/club")
    await revokeOrReplaceMembership(order.id, "payment_cancelled")

    try {
      await logOrderEvent(
        order.id,
        "cancelled",
        "Payment Cancelled",
        "Payment was not completed. Order auto-cancelled.",
        "system"
      )
    } catch (logError) {
      console.warn(
        "[cancelPendingPaymentOrders] Failed to log event for order:",
        order.id,
        logError
      )
    }

    cancelledCount++
  }

  return { cancelledCount }
}
